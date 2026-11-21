"""Standalone breed library: orbit inspection and launch selected dog in game."""
import math
import subprocess
import sys
import unicodedata
from direct.gui.DirectGui import DirectButton, DirectFrame, DirectScrolledFrame, DirectEntry, DirectOptionMenu, DirectSlider
from direct.gui.OnscreenText import OnscreenText
from panda3d.core import TextNode, Vec3
from play_park import Park, ROOT
from catalog import AGE_STAGES, TYPES, AVAILABLE_DOGS as DOGS, ear_cache_path
from ear_shapes import EAR_STYLES
from dog_frames import FRAMES


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFD',value.lower().replace('đ','d'))
                   if unicodedata.category(c)!='Mn')


SEARCH_TEXT={d['id']:normalized(d['name']+' '+d['id']+' '+d['variant_label']) for d in DOGS}


class DogLibrary(Park):
    def __init__(self):
        self.focus_head=False
        self.orbit=145.; self.elevation=15.; self.zoom=3.4
        self.dragging=False;self.last_mouse=None;self.auto_rotate=False
        self.game_process=None;self.game_selection=None
        self.ear_style='base';self.ear_error=''
        self.current_clip='Idle';self.filter_group=TYPES[0]['name'];self.query='';self.loading=False
        super().__init__()
        self.dog.setPos(0,0,.025)
        self.accept('mouse1',self.start_drag);self.accept('mouse1-up',self.stop_drag)
        self.accept('mouse3',self.start_drag);self.accept('mouse3-up',self.stop_drag)
        self.accept('wheel_up',self.zoom_by,[.88]);self.accept('wheel_down',self.zoom_by,[1.14])
        self.accept('escape',self.stop_drag)
        self.accept('f',self.front_view);self.accept('v',self.side_view)
        self.hint.setText('Kéo chuột ở vùng mẫu để xoay • Cuộn để zoom • B: xương • F: trước • V: bên')
        self.selection_text.setText(f'GIỐNG • VÓC DÁNG • LỨA TUỔI | {len(TYPES)} NHÓM • {len(DOGS)} MẪU')
        self.selection_text.reparentTo(self.a2dTopCenter);self.selection_text.setPos(0,-.07)
        self.hint.reparentTo(self.a2dBottomCenter);self.hint.setPos(0,.07);self.hint.setScale(.031)
        for child in self.aspect2d.getChildren():
            if isinstance(child.node(),TextNode) and 'WASD' in child.node().getText():child.hide()
        self.camera.setPos(2,3,1.3)
        self.refresh_list()
        self.pipeline.exposure=.05

    def create_controls(self):
        self.panel=DirectFrame(parent=self.a2dTopLeft,pos=(.025,0,-.10),frameSize=(0,.65,-1.76,0),frameColor=(.035,.052,.065,.97))
        def label(parent,text,x,z,scale=.033):
            return OnscreenText(parent=parent,text=text,pos=(x,z),scale=scale,align=TextNode.ALeft,fg=(.88,.92,.95,1),mayChange=True)
        label(self.panel,'GIỐNG / DÁNG / LỨA TUỔI',.035,-.065,.040)
        self.search=DirectEntry(parent=self.panel,initialText='',width=16,scale=.033,pos=(.035,0,-.14),
            command=self.search_dogs,focusOutCommand=self.search_dogs)
        label(self.panel,'Tìm: chó con, chó nhỡ, mập… (Enter)',.035,-.19,.025)
        self.group_menu=DirectOptionMenu(parent=self.panel,items=[t['name'] for t in TYPES],scale=.033,
            pos=(.035,0,-.26),command=self.filter_dogs)
        self.scroll=DirectScrolledFrame(parent=self.panel,frameSize=(.02,.63,-1.58,-.31),canvasSize=(0,.58,-2.5,0),
            scrollBarWidth=.025,frameColor=(.05,.075,.09,1))
        self.list_buttons=[];self.list_indices=[]
        self.count_text=label(self.panel,'',.035,-1.69,.029)
        self.refresh_list()
        self.rig_text=label(self.panel,'',.035,-1.74,.022)
        self.details_panel=DirectFrame(parent=self.a2dTopRight,pos=(-.64,0,-.10),frameSize=(0,.61,-1.76,0),frameColor=(.035,.052,.065,.97))
        self.name_text=label(self.details_panel,'',.035,-.07,.039)
        self.detail_text=label(self.details_panel,'',.035,-.15,.027)
        label(self.details_panel,'KIỂU TAI (ĐỘC LẬP)',.035,-.43,.029)
        self.ear_menu=DirectOptionMenu(parent=self.details_panel,items=list(EAR_STYLES.values()),scale=.031,
            pos=(.035,0,-.50),command=self.choose_ears)
        label(self.details_panel,'CHUYỂN ĐỘNG',.035,-.60)
        self.anim_menu=DirectOptionMenu(parent=self.details_panel,items=['Idle','Walk','Trot','Gallop','Sit_Idle','Lie_Idle','Pee'],
            scale=.036,pos=(.035,0,-.68),command=self.set_clip)
        self.buttons=[]
        for text,z,cmd in [('Xoay tự động',-.80,self.toggle_auto),('Khung xương [B]',-.90,self.toggle_skeleton),
                            ('Tạm dừng [Space]',-1.00,self.toggle_pause),('Thử trong thế giới 3D',-1.48,self.open_game)]:
            self.buttons.append(DirectButton(parent=self.details_panel,text=text,scale=.030,pos=(.30,0,z),
                frameSize=(-8.3,8.3,-.6,1.1),frameColor=(.13,.25,.28,1),text_fg=(.94,.97,.98,1),command=cmd))
        for text,x,command in [('Trước [F]',.16,self.front_view),('Bên [V]',.44,self.side_view)]:
            DirectButton(parent=self.details_panel,text=text,pos=(x,0,-1.10),scale=.029,
                frameSize=(-4.1,4.1,-.6,1.1),frameColor=(.13,.25,.28,1),text_fg=(.94,.97,.98,1),command=command)
        self.head_button=DirectButton(parent=self.details_panel,text='Xem đầu / tai',pos=(.30,0,-1.20),scale=.030,
            frameSize=(-8.3,8.3,-.6,1.1),frameColor=(.13,.25,.28,1),text_fg=(.94,.97,.98,1),command=self.head_view)
        label(self.details_panel,'Ánh sáng',.035,-1.31,.029)
        self.light_slider=DirectSlider(parent=self.details_panel,range=(-1.5,1),value=.05,scale=.23,pos=(.30,0,-1.37),command=self.change_lighting)
        label(self.details_panel,'Mẫu tham số • cần tinh chỉnh',.035,-1.60,.026)
        self.status=OnscreenText(text='',pos=(0,-.85),scale=.032,fg=(.8,.87,.92,1),mayChange=True)

    def select_dog(self,index):
        if self.loading:return
        previous_pause=self.paused
        phase=None
        if self.model is not None:
            frame=self.model.getCurrentFrame(self.current_clip)
            if frame is not None:phase=frame/max(1,self.model.getNumFrames(self.current_clip)-1)
        self.loading=True
        try:
            type_name=self.catalog[index]['type_name']
            if self.filter_group!=type_name:
                self.filter_group=type_name
                self.query=''
                self.group_menu.set(next(i for i,t in enumerate(TYPES) if t['name']==type_name),fCommand=0)
                self.refresh_list()
            asset=self.catalog[index]['asset']
            cache=ear_cache_path(self.catalog[index],self.ear_style)
            if self.ear_style!='base' and cache.exists():asset=str(cache)
            self.ear_error='Mẫu tai chưa có sẵn' if self.ear_style!='base' and not cache.exists() else ''
            row=list(self.dog_types[index]);row[1]=asset;self.dog_types[index]=tuple(row)
            self.displayed_ear_style=self.ear_style if asset!=self.catalog[index]['asset'] else 'base'
            Park.select_dog(self,index)
            # This screen has its own compact animation menu.
            for button in self.clip_buttons:button.destroy()
            self.clip_buttons=[]
            self.dog.setPos(0,0,.025)
            pose_frame=int(round(phase*(self.model.getNumFrames(self.current_clip)-1))) if phase is not None else 0
            if phase is not None or previous_pause:self.model.pose(self.current_clip,pose_frame)
            if not previous_pause:self.model.loop(self.current_clip,restart=phase is None)
            self.paused=previous_pause
            self.model.setPlayRate(0 if self.paused else 1,self.current_clip)
            self.model.setControlEffect('Idle',0)
            self.model.setControlEffect(self.current_clip,1)
            dog=self.catalog[index];p=dog['profile']
            self.name_text.setText(dog['variant_label'])
            self.name_text.setScale(.034)
            group={'Vietnam':'Việt Nam','Companion':'Nuôi cảnh','Working':'Làm việc'}[dog['group']]
            tail={'natural':'Dài tự nhiên','curl':'Cong / cuộn','bob':'Cộc','short':'Ngắn'}[p['tail']]
            age=AGE_STAGES[dog.get('age_stage','adult')]
            coat='sợi mảnh / nhiều lớp' if p.get('groom_quality',1)>=2 else ('dày (phác thảo)' if p['fur']>.08 else 'ngắn / vừa')
            frame=FRAMES[p['anatomy_frame']]['label'] if p.get('anatomy_frame') else 'Mẫu cũ'
            self.detail_text.setText(f"{dog['type_name']}\nDáng: {dog['variant_label']} • {age}\nKhung: {frame}\nTai: {EAR_STYLES[self.displayed_ear_style] if self.displayed_ear_style!='base' else 'Theo mẫu cơ sở'}\nĐuôi: {tail}\nLông: {coat}\nMã mẫu: {dog['id']}")
            self.rig_text.setText(f'{len(self.joints)} khớp • ngón chân + đầu mút')
            self.selection_text.setText(f'GIỐNG • VÓC DÁNG • LỨA TUỔI | {len(TYPES)} NHÓM • {len(DOGS)} MẪU')
            for i,button in zip(self.list_indices,self.list_buttons):button['frameColor']=(.15,.42,.36,1) if i==index else (.09,.14,.17,1)
        finally:self.loading=False

    def refresh_list(self):
        for button in getattr(self,'list_buttons',[]):button.destroy()
        self.list_buttons=[];self.list_indices=[]
        type_id=next(t['id'] for t in TYPES if t['name']==self.filter_group)
        query=normalized(self.query)
        for i,dog in enumerate(self.catalog):
            if dog['type_id']!=type_id:continue
            if query not in SEARCH_TEXT[dog['id']]:continue
            row=len(self.list_buttons)
            button=DirectButton(parent=self.scroll.getCanvas(),text=dog['variant_label'],scale=.034,pos=(.025,0,-.055-row*.078),
                text_align=TextNode.ALeft,frameSize=(-.3,17,-.65,1.15),frameColor=(.09,.14,.17,1),text_fg=(.92,.95,.97,1),
                command=self.select_dog,extraArgs=[i])
            self.list_buttons.append(button);self.list_indices.append(i)
        self.scroll['canvasSize']=(0,.56,-max(1.24,len(self.list_buttons)*.078+.04),0)
        self.scroll.verticalScroll['value']=0
        if hasattr(self,'count_text'):self.count_text.setText(f'{len(self.list_buttons)} mẫu • có chó con / nhỡ')

    def search_dogs(self,text=None):
        self.query=self.search.get() if hasattr(self,'search') else ''
        self.refresh_list()
    def filter_dogs(self,choice):
        self.filter_group=choice
        if hasattr(self,'group_menu'):
            self.group_menu.set(next(i for i,t in enumerate(TYPES) if t['name']==choice),fCommand=0)
        self.query=''
        if hasattr(self,'search'):self.search.enterText('')
        if hasattr(self,'scroll'):
            self.refresh_list()
            if hasattr(self,'name_text') and self.list_indices:self.select_dog(self.list_indices[0])
    def next_variant(self,direction):
        indices=[i for i,d in enumerate(self.catalog) if d['type_id']==self.catalog[self.selected_index]['type_id']]
        self.select_dog(indices[(indices.index(self.selected_index)+direction)%len(indices)])

    def choose_ears(self,label):
        self.ear_style=next(k for k,v in EAR_STYLES.items() if v==label)
        self.ear_error=''
        if self.model is not None and hasattr(self,'selected_index'):
            self.select_dog(self.selected_index)

    def toggle_pause(self):
        self.paused=not self.paused
        if self.paused:
            frame=self.model.getCurrentFrame(self.current_clip) or 0
            self.model.pose(self.current_clip,frame)
            self.model.setPlayRate(0,self.current_clip)
        else:
            self.model.loop(self.current_clip,restart=False)
            self.model.setPlayRate(1,self.current_clip)

    def set_clip(self,clip):
        if clip=='Pee':
            self.current_clip='Idle'
            self.start_pee()
            return
        self.pee.stop()
        self.current_clip=clip
        if self.model:
            for name in self.model.getAnimNames():self.model.setControlEffect(name,0)
            self.model.loop(clip);self.model.setControlEffect(clip,1)
            if self.paused:self.model.pose(clip,0);self.model.setPlayRate(0,clip)
    def capture_mouse(self,capture):pass
    def start_drag(self):
        if self.mouseWatcherNode.hasMouse():
            # Exclude both UI panels in screen coordinates.
            x=self.mouseWatcherNode.getMouseX()*self.getAspectRatio()
            ui_scale=getattr(self,'ui_scale',1)
            if x<self.a2dLeft+.70*ui_scale or x>self.a2dRight-.67*ui_scale:return
            self.dragging=True;self.last_mouse=None
    def stop_drag(self):self.dragging=False;self.last_mouse=None
    def zoom_by(self,factor):self.zoom=max(1.1,min(7,self.zoom*factor))
    def toggle_auto(self):self.auto_rotate=not self.auto_rotate
    def front_view(self):self.orbit=180;self.elevation=10;self.zoom=1.5 if self.focus_head else 3.1
    def side_view(self):self.orbit=90;self.elevation=10;self.zoom=1.5 if self.focus_head else 3.1
    def head_view(self):
        self.focus_head=not self.focus_head
        self.zoom=1.5 if self.focus_head else 3.4
        self.elevation=8 if self.focus_head else 15
        self.head_button['text']='Xem toàn thân' if self.focus_head else 'Xem đầu / tai'
    def open_game(self):
        if self.ear_style!=self.displayed_ear_style:return
        selection=(self.catalog[self.selected_index]['id'],self.ear_style)
        if self.game_process is not None and self.game_process.poll() is None:
            if self.game_selection==selection:return
            self.game_process.terminate()
        command=[sys.executable,str(ROOT/'play_park.py'),'--breed',self.catalog[self.selected_index]['id']]
        if self.ear_style!='base':command+=['--ear-asset',str(ear_cache_path(self.catalog[self.selected_index],self.ear_style))]
        self.game_process=subprocess.Popen(command,cwd=ROOT)
        self.game_selection=selection
    def update(self,task):
        dt=min(self.clock.getDt(),.05)
        if self.dragging and self.mouseWatcherNode.hasMouse():
            mouse=self.mouseWatcherNode.getMouse();pos=(mouse.x,mouse.y)
            if self.last_mouse:
                self.orbit-=(pos[0]-self.last_mouse[0])*160
                self.elevation=max(-10,min(75,self.elevation+(pos[1]-self.last_mouse[1])*110))
            self.last_mouse=pos
        if self.auto_rotate:self.orbit+=dt*22
        self.model.setPlayRate(0 if self.paused else 1,self.current_clip)
        h=self.dog_height;target=self.dog.getPos()+Vec3(0,0,h*.55)
        if self.focus_head:target=self.joints[25].getPos(self.render)+Vec3(0,h*.06,h*.025)
        yaw=math.radians(self.orbit);pitch=math.radians(self.elevation)
        aspect=self.getAspectRatio();self.ui_scale=.78 if aspect<1.2 else 1
        self.panel.setScale(self.ui_scale);self.details_panel.setScale(self.ui_scale)
        self.details_panel.setX(-.64*self.ui_scale)
        available=max(.30,2*aspect-1.38*self.ui_scale)
        fraction=available/(2*aspect)
        fov=self.camLens.getFov()
        projected=(abs(math.cos(yaw))*.4*h+abs(math.sin(yaw))*.55*h) if self.focus_head else (abs(math.cos(yaw))*self.model_extents.x+abs(math.sin(yaw))*self.model_extents.y)
        horizontal_fit=projected*1.12/(2*math.tan(math.radians(fov.x/2))*fraction)
        dist=max(.25,h*self.zoom*.5,horizontal_fit*(self.zoom/1.5)) if self.focus_head else max(.7,h*self.zoom,horizontal_fit*(self.zoom/3.4))
        self.camera.setPos(target+Vec3(math.sin(yaw)*dist*math.cos(pitch),-math.cos(yaw)*dist*math.cos(pitch),dist*math.sin(pitch)))
        self.camera.lookAt(target)
        self.sun_np.setPos(self.dog.getPos()+Vec3(-8,-10,16));self.sun_np.lookAt(target)
        self.pee.update(0 if self.paused else dt)
        self.draw_skeleton()
        action='Pee' if self.pee.active else self.current_clip
        self.status.setText(action+(' • TẠM DỪNG' if self.paused else '')+'   |   '+self.catalog[self.selected_index]['name']+(' • '+self.ear_error if self.ear_error else ''))
        return task.cont

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--breed',choices=[d['id'] for d in DOGS])
    args=parser.parse_args()
    if args.breed:DogLibrary.initial_index=next(i for i,d in enumerate(DOGS) if d['id']==args.breed)
    DogLibrary().run()
