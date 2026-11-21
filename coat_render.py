"""Surface-bound fur strokes and micro-relief over the existing PBR lighting.

The rest-space field stays attached to animated skin. Analytic pixel-footprint
filtering fades unresolved fibres instead of producing sparkling or alpha haze.
No mesh rebuild or per-frame texture generation is needed.
"""
from functools import lru_cache
import numpy as np
from panda3d.core import (AlphaTestAttrib,BitMask32,GeomNode,MaterialAttrib,Shader,ShaderAttrib,
                         ShaderInput,Texture,TransparencyAttrib,Vec4)
from dog_shape import deform

FUR_FIELD=r'''
uniform vec4 fur_nose;
uniform vec4 fur_eye_left;
uniform vec4 fur_eye_right;
uniform float fur_strength;
uniform float fur_polish;
uniform float fur_is_strand;
uniform float fur_is_card;
varying vec3 v_fur_position;
varying vec3 v_fur_normal;
uniform mat4 p3d_ViewMatrixInverse;

float fibreHash(float lane) {
    vec3 p=fract(vec3(lane)*vec3(.1031,.1137,.0973));
    p+=dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
}
float hairStrokes(vec2 p,float density,float warp) {
    float cell=p.x*density+warp;
    float footprint=fwidth(cell);
    if (footprint>=1.0) return 0.0;
    float lane=floor(cell);
    float center=.24+.52*fibreHash(lane);
    float width=.06+.10*fibreHash(lane+83.0);
    float aa=min(footprint*.6,.4)+.025;
    float stroke=1.0-smoothstep(width,width+aa,abs(fract(cell)-center));
    float segment=fract(p.y*(24.0+18.0*fibreHash(lane+19.0))*mix(1.0,2.4,fur_polish)+fibreHash(lane+7.0)*5.0);
    float taper=smoothstep(.02,.18,segment)*(1.0-smoothstep(.65,.98,segment));
    return (stroke*taper-.09)*(1.0-smoothstep(.35,1.0,footprint));
}
float fibreField(vec2 p) {
    float warp=.16*sin(p.y*31.0)+.06*sin(p.y*89.0);
    return .62*hairStrokes(p,140.0,warp)+.38*hairStrokes(p,620.0,warp);
}
float coatField(vec3 p,vec3 normal) {
    vec3 w=abs(normal);w*=w;w*=w;w*=w;
    w/=max(dot(w,vec3(1.0)),.00001);
    float side=fibreField(vec2(p.y*.90-p.z*.43,p.y*.43+p.z*.90));
    float face=fibreField(vec2(p.x+.04*sin(p.z*22.0),p.z));
    float back=fibreField(vec2(p.x,p.y));
    return dot(w,vec3(side,face,back));
}
float featureMask(vec3 p,vec4 feature) {
    return smoothstep(feature.w*.80,feature.w*1.35,length(p-feature.xyz));
}
float coatMask(vec3 p) {
    return featureMask(p,fur_nose)*featureMask(p,fur_eye_left)*featureMask(p,fur_eye_right)
           *smoothstep(.025,.10,p.z)*fur_strength;
}
vec3 fibreNormal(vec3 normal,vec3 viewPosition,float height) {
    vec3 dx=dFdx(viewPosition),dy=dFdy(viewPosition);
    vec3 r1=cross(dy,normal),r2=cross(normal,dx);
    float determinant=dot(dx,r1);
    vec3 gradient=(dFdx(height)*r1+dFdy(height)*r2)*sign(determinant)/max(abs(determinant),.0000001);
    gradient/=max(1.0,length(gradient)/.26);
    return normalize(normal-gradient);
}
'''


@lru_cache(maxsize=8)
def coat_shader(hardware,shadows,core,max_lights):
    import simplepbr
    defines=dict(MAX_LIGHTS=max_lights,ENABLE_SHADOWS=shadows,USE_330=core,
                 ENABLE_SKINNING=hardware,CALC_NORMAL_Z=True)
    vert=simplepbr.shaderutils._load_shader_str('simplepbr.vert',dict(defines))
    frag=simplepbr.shaderutils._load_shader_str('simplepbr.frag',dict(defines))
    qualifier='out' if core else 'varying'
    vert=vert.replace('void main() {',f'{qualifier} vec3 v_fur_position;\n{qualifier} vec3 v_fur_normal;\nvoid main() {{\n    v_fur_position=p3d_Vertex.xyz;\n    v_fur_normal=p3d_Normal;')
    field=FUR_FIELD.replace('varying ','in ') if core else FUR_FIELD
    frag=frag.replace('void main() {',field+'\nvoid main() {')
    marker='    vec3 diffuse_color = (base_color.rgb * (vec3(1.0) - F0)) * (1.0 - metallic);'
    assert marker in frag,'PBR shader interface changed'
    frag=frag.replace(marker,'''    float furMask=0.0;
    if (fur_is_card>.5) {
        float coverage=smoothstep(.22,.66,base_color.a);
        if (coverage<.02) discard;
        base_color.a=coverage;
    }
    float furDetail=0.0;
    if (fur_is_strand<.5) {
        furMask=coatMask(v_fur_position);
        furDetail=coatField(v_fur_position,normalize(v_fur_normal));
    }
    base_color.rgb*=1.0+furDetail*mix(.17,.25,fur_polish)*furMask;
    if (fur_is_strand<.5 && fur_polish>.5) {
        float noseWet=1.0-smoothstep(fur_nose.w*.55,fur_nose.w,length(v_fur_position-fur_nose.xyz));
        float eyeWet=max(1.0-smoothstep(fur_eye_left.w*.50,fur_eye_left.w*.90,length(v_fur_position-fur_eye_left.xyz)),
                         1.0-smoothstep(fur_eye_right.w*.50,fur_eye_right.w*.90,length(v_fur_position-fur_eye_right.xyz)));
        perceptual_roughness=mix(perceptual_roughness,.30,noseWet);
        perceptual_roughness=mix(perceptual_roughness,.16,eyeWet);
        base_color.rgb=mix(base_color.rgb,base_color.rgb*vec3(.22,.13,.07)+vec3(.008),eyeWet*.85);
    }
    alpha_roughness=perceptual_roughness*perceptual_roughness;
'''+marker)
    marker='    vec3 world_normal = normalize(v_world_tbn * normalmap);'
    assert marker in frag,'PBR normal interface changed'
    frag=frag.replace(marker,marker+'''
    if (fur_is_strand<.5) n=fibreNormal(n,v_view_position,furDetail*mix(.00025,.00045,fur_polish)*furMask);
    world_normal=normalize(mat3(p3d_ViewMatrixInverse)*n);
''')
    marker='        color.rgb += func_params.n_dot_l * lightcol * (diffuse_contrib + spec_contrib) * shadow;'
    assert marker in frag,'PBR light interface changed'
    frag=frag.replace(marker,marker+'''
        if (fur_is_strand>.5 && fur_polish>.5) {
            // Broad strand-aligned highlights. This term is lit and shadowed,
            // never emission; it follows the exported, skinned hair tangents.
            vec3 fibreT=normalize(v_view_tbn[0]);
            float tangentH=clamp(dot(fibreT,h),-1.0,1.0);
            float sinTH=sqrt(max(0.0,1.0-tangentH*tangentH));
            float s2=sinTH*sinTH,s4=s2*s2,s8=s4*s4,s16=s8*s8;
            float sheen=.040*s16*s4*s2+.012*s4*sinTH;
            color.rgb+=sqrt(max(base_color.rgb,vec3(.001)))*lightcol*sheen*func_params.n_dot_l*shadow;
        }
''')
    shader=Shader.make(Shader.SL_GLSL,vert,frag)
    shader.setFilename(Shader.ST_none,'surface fur / PBR')
    return shader


def feature_inputs(model,profile,strength=1.):
    points=deform([[0,1.052,.917],[.092,1.165,.747],[-.092,1.165,.747]],profile)
    points=points[:,[0,2,1]]*np.array([1.,-1.,1.])
    for key,p,radius in zip(('fur_nose','fur_eye_left','fur_eye_right'),points,(.065,.027,.027)):
        model.setShaderInput(key,Vec4(*map(float,p),radius*profile.get('head',1.)))
    model.setShaderInput('fur_strength',0. if profile.get('fur_distribution')=='crest' else strength)
    model.setShaderInput('fur_polish',1. if profile.get('groom_quality',1)>=2 else 0.)
    model.setShaderInput('fur_is_strand',0.)
    model.setShaderInput('fur_is_card',0.)


def coat_material(state):
    material=state.getAttrib(MaterialAttrib)
    name=material.getMaterial().getName().lower() if material and material.getMaterial() else ''
    return not any(part in name for part in ('mouth','tongue','teeth'))


def apply_coat_detail(model,profile,pipeline):
    shader=coat_shader(pipeline.enable_hardware_skinning,pipeline.enable_shadows,
                       pipeline.use_330,pipeline.max_lights)
    attr=ShaderAttrib.make(shader)
    if pipeline.enable_hardware_skinning:
        attr=attr.setFlag(ShaderAttrib.F_hardware_skinning,True)
    feature_inputs(model,profile)
    count=0
    for path in model.findAllMatches('**/+GeomNode'):
        node=path.node()
        for i in range(node.getNumGeoms()):
            state=node.getGeomState(i)
            if not coat_material(state):
                continue
            # Keep the root PBR camera/environment inputs composable. A higher
            # ShaderAttrib override would discard the pipeline's live inputs.
            material=state.getAttrib(MaterialAttrib)
            name=material.getMaterial().getName().lower() if material else ''
            card='groom cards' in name
            strand_attr=attr.setShaderInput(ShaderInput('fur_is_strand',1. if 'strand fur' in name or card else 0.))
            strand_attr=strand_attr.setShaderInput(ShaderInput('fur_is_card',1. if card else 0.))
            if card:
                state=state.setAttrib(TransparencyAttrib.make(TransparencyAttrib.M_multisample),2)
                state=state.setAttrib(AlphaTestAttrib.make(AlphaTestAttrib.M_always,0.),2)
            node.setGeomState(i,state.setAttrib(strand_attr,0));count+=1
    for texture in model.findAllTextures():
        texture.setMinfilter(Texture.FT_linear_mipmap_linear)
        texture.setMagfilter(Texture.FT_linear)
        texture.setAnisotropicDegree(16)
    isolate_card_shadows(model)
    return count


def isolate_card_shadows(model):
    """Keep fine cutouts out of the body shadow map, sharing skinned data."""
    for path in list(model.findAllMatches('**/+GeomNode')):
        if path.getName()=='rooted fur cards':continue
        node=path.node()
        for i in reversed(range(node.getNumGeoms())):
            state=node.getGeomState(i);material=state.getAttrib(MaterialAttrib)
            if not material or 'groom cards' not in material.getMaterial().getName().lower():continue
            hair=GeomNode('rooted fur cards');hair.addGeom(node.modifyGeom(i),state)
            path.attachNewNode(hair).hide(BitMask32.bit(2))
            node.removeGeom(i)


def preview_shader_sources(vertex,fragment):
    vertex=vertex.replace('void main() {','''uniform mat4 p3d_ModelViewMatrix;
varying vec3 v_fur_position;
varying vec3 v_fur_normal;
varying vec3 v_fur_view;
void main() {
    v_fur_position=p3d_Vertex.xyz;
    v_fur_normal=p3d_Normal;
    v_fur_view=(p3d_ModelViewMatrix*p3d_Vertex).xyz;
''')
    fragment=fragment.replace('void main() {',FUR_FIELD+'\nvarying vec3 v_fur_view;\nvoid main() {')
    fragment=fragment.replace('    float light =','''    float mask=coatMask(v_fur_position);
    float detail=coatField(v_fur_position,normalize(v_fur_normal));
    base.rgb*=1.0+detail*.17*mask;
    vec3 strandNormal=fibreNormal(normalize(normal),v_fur_view,detail*.00025*mask);
    float light =''')
    fragment=fragment.replace('dot(normalize(normal), normalize(vec3','dot(strandNormal, normalize(vec3')
    return vertex,fragment


def apply_preview_detail(model,profile):
    feature_inputs(model,profile,strength=0.)
    for path in model.findAllMatches('**/+GeomNode'):
        node=path.node()
        for i in range(node.getNumGeoms()):
            state=node.getGeomState(i)
            attr=state.getAttrib(ShaderAttrib) or ShaderAttrib.make()
            attr=attr.setShaderInput(ShaderInput('fur_strength',1. if coat_material(state) else 0.))
            node.setGeomState(i,state.setAttrib(attr,0))
