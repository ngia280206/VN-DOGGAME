"""Frame-rate independent controller integration, shared by runtime checks."""
import math


def response(rate,dt):
    return -math.expm1(-rate*max(0.,dt))


def integrate_speed(speed,target,rate,dt):
    if dt<=0:return speed,0.
    ease=response(rate,dt)
    next_speed=speed+(target-speed)*ease
    distance=target*dt+(speed-target)*ease/rate
    return max(0.,next_speed),max(0.,distance)


def damp_heading(heading,target,velocity,dt):
    difference=(target-heading+180.)%360.-180.
    desired=max(-240.,min(240.,difference*8.))
    next_velocity=velocity+(desired-velocity)*response(12.,dt)
    step=(velocity+next_velocity)*.5*dt
    if step*difference>0 and abs(step)>=abs(difference):
        return heading+difference,0.
    return heading+step,next_velocity
