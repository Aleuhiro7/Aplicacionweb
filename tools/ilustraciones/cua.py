from engine import *

AY = FLOOR - 7  # altura del tobillo de pie en el suelo

def stand(x=170, **k):
    return Fig((x, AY - 87), ankle=(x + 2, AY), **k)

# ---------- sentadillas con barra ----------
def back_squat(frame=None, dx=0, front_bar=False):
    def pose(down):
        ank = (178 + dx, AY)
        if not down:
            hip = (175 + dx, AY - 87); t = -88 if not front_bar else -89
        else:
            hip = (140 + dx, AY - 47) if not front_bar else (150 + dx, AY - 45); t = -58 if not front_bar else -72
        sh = at(hip, t, L['torso'])
        if front_bar:
            bar = (sh[0] + 9, sh[1] - 1)
            f = Fig(hip, t, hand=(bar[0] - 2, bar[1] + 2), elbow='fwd', ankle=ank, head=t - 4)
        else:
            bar = at(at(sh, t + 180 + 0, -2), t - 90, 9)
            f = Fig(hip, t, hand=at(bar, t + 90, 3), elbow='down', ankle=ank, head=t + 14)
        return scene(frame or '', f.svg(front=barbell(bar, 19)))
    return lambda: (pose(False), pose(True))

def hack(rail=-117, travel=40, pend=False):
    def pose(down):
        ank = (212, AY - 6)
        up = at(ank, rail, 86)
        hip = at(up, rail + 180, travel) if down else up
        f = Fig(hip, rail if not down else rail + 8, ankle=ank, knee='fwd', foot=-10,
                hand=at(at(hip, rail if not down else rail + 8, L['torso']), (rail + 210), 14), elbow='down')
        back = rail - 90  # perpendicular, hacia atrás
        r0 = at(at((ank[0] + 10, FLOOR), back, 22), rail, 0)
        mach = line(at((ank[0] + 8, FLOOR + 2), back, 24), at(at((ank[0] + 8, FLOOR + 2), back, 24), rail, 215), 9, DARK)
        pad_a = at(hip, back, 15); pad_b = at(at(hip, rail if not down else rail + 8, L['torso'] + 2), back, 15)
        mach += line(pad_a, pad_b, 12, PAD)
        mach += poly([(ank[0] - 14, FLOOR - 4), (ank[0] + 30, FLOOR - 16), (ank[0] + 32, FLOOR - 8), (ank[0] - 14, FLOOR + 1)], DARK)
        if pend:
            piv = (120, 26); mach += line(piv, pad_b, 8, METAL) + circle(piv, 7, DARK) + rect(110, 26, 8, FLOOR - 26, DARK, 1)
        return scene(mach, f.svg())
    return lambda: (pose(False), pose(True))

def belt_squat():
    def pose(down):
        ank = (175, FLOOR - 32)
        hip = (172, ank[1] - 86) if not down else (150, ank[1] - 46)
        t = -88 if not down else -70
        f = Fig(hip, t, ankle=ank, hand=(222, 118 if not down else 128), elbow='down')
        m = rect(110, FLOOR - 26, 130, 26, DARK, 4) + rect(214, 112, 10, FLOOR - 112, DARK, 2) + rect(206, 112, 30, 7, METAL, 3)
        m += line((hip[0] + 4, hip[1] + 6), (178, FLOOR - 26), 3, '#30343a') + circle((178, FLOOR - 22), 8, IRON)
        return scene(m, f.svg(front=rect(hip[0] - 15, hip[1] - 4, 30, 9, '#7b4b2a', 4)))
    return lambda: (pose(False), pose(True))

# ---------- prensas ----------
def press45(narrow=False, single=False, feet_high=False):
    def pose(down):
        hip = (128, 168)
        d = -42
        reach = 84 if not down else 46
        ank = at(hip, d, reach)
        if feet_high: ank = (ank[0] - 4, ank[1] - 10)
        f = Fig(hip, -158, head=-140, ankle=ank, knee='up', foot=d - 90 + 180 - 180 + 0,
                ankle2=ank if not single else (hip[0] + 30, hip[1] + 32), knee2='up', foot2=0 if single else None,
                hand=(150, 182), elbow='down')
        f.foot = d - 90
        if not single: f.foot2 = f.foot
        # máquina: rail a 45° y plataforma
        r0 = (150, 208); r1 = at(r0, -45, 200)
        m = poly([(60, 160), (150, 178), (150, 196), (60, 182)], DARK)
        m += line((70, 160), (128, 176), 12, PAD) + line(at(hip, -158, -6), at(hip, -158, 70), 13, PAD)
        m += line(r0, r1, 9, DARK)
        pc = at(ank, d + 90, -2)
        pl = (at(at(ank, d, 9), d + 90, 34), at(at(ank, d, 9), d - 90, 30))
        m += line(at(pl[0], 0, 0), pl[1], 9, IRON)
        m += plate(at(at(ank, d, 34), d + 90, 6), 20)
        m += rect(140, 196, 140, 10, DARK, 3)
        return scene(m, f.svg())
    return lambda: (pose(False), pose(True))

# ---------- unilaterales ----------
def bulgarian(smith_bar=False):
    def pose(down):
        bench_top = FLOOR - 50
        ank = (200, AY); ank2 = (102, bench_top - 4)
        hip = (160, 118) if not down else (152, 152)
        t = -86 if not down else -80
        if smith_bar:
            sh = at(hip, t, L['torso']); bar = (sh[0] - 6, sh[1] - 1)
            f = Fig(hip, t, ankle=ank, ankle2=ank2, knee2='down', foot2=170, hand=(bar[0] + 4, bar[1] + 1), elbow='down')
            return scene(smith(118, 250), bench(60, 125, bench_top), f.svg(front=barbell(bar, 20)))
        sh = at(hip, t, L['torso'])
        f = Fig(hip, t, ankle=ank, ankle2=ank2, knee2='down', foot2=170, hand=(sh[0] + 2, sh[1] + 62), elbow='back')
        return scene(bench(60, 125, bench_top), f.svg(mid='', front=dumbbell(f.hand, 0)))
    return lambda: (pose(False), pose(True))

def lunge():
    def pose(down):
        if not down:
            f = stand(160, hand=(162, 152))
        else:
            hip = (150, 150)
            f = Fig(hip, -86, ankle=(205, AY), ankle2=(105, AY - 4), knee2='down', foot2=30, hand=(152, 150 + 3))
            f2 = Fig(hip, -86, ankle=(205, AY), ankle2=(105, AY - 4), knee2='down', foot2=30, hand=(f.sh[0] + 2, f.sh[1] + 62))
            f = f2
        if not down: f = stand(160, hand=(f.sh[0] + 2, f.sh[1] + 62))
        return scene(f.svg(front=dumbbell(f.hand, 0)))
    return lambda: (pose(False), pose(True))

def stepup():
    def pose(down):
        bx, bh = 185, 36
        if not down:
            hip = (170, 122)
            f0 = Fig(hip, -84, ankle=(210, FLOOR - bh - 7), ankle2=(150, AY), knee='up')
        else:
            hip = (212, FLOOR - bh - 7 - 87)
            f0 = Fig(hip, -88, ankle=(214, FLOOR - bh - 7), ankle2=(222, FLOOR - bh - 7))
        f = Fig(f0.hip, -84 if not down else -88, ankle=f0.ank, ankle2=f0.ank2, knee='up' if not down else 'fwd',
                hand=(f0.sh[0] + 2, f0.sh[1] + 62))
        return scene(box(bx, 70, bh), f.svg(front=dumbbell(f.hand, 0)), zoom=0.86, cx=200)
    return lambda: (pose(False), pose(True))

def goblet():
    def pose(down):
        ank = (178, AY - 5)
        hip = (174, AY - 92) if not down else (150, AY - 50)
        t = -88 if not down else -74
        sh = at(hip, t, L['torso'])
        hand = (sh[0] + 14, sh[1] + 20)
        f = Fig(hip, t, ankle=ank, hand=hand, elbow='down', foot=8)
        wedge = poly([(160, FLOOR), (205, FLOOR), (160, FLOOR - 10)], '#5b6470')
        return scene(wedge, f.svg(front=dumbbell((hand[0] + 2, hand[1] - 4), 90, 1.05)))
    return lambda: (pose(False), pose(True))

# ---------- aislamiento ----------
def leg_ext(single=False, cable_=False):
    def pose(up):
        hip = (138, 150); knee_p = (183, 152)
        ank = (178, 194) if not up else (226, 140)
        ank2 = (178, 194) if single else ank
        f = Fig(hip, -100, ankle=ank, ankle2=ank2, knee='fwd', hand=(150, 164), elbow='down', foot=-20 if up else 70)
        if single: f.foot2 = 70
        m = rect(95, 150, 95, 14, PAD, 6) + poly([(98, 152), (112, 152), (100, 72), (86, 72)], PAD)
        m += rect(130, 162, 12, FLOOR - 162, DARK, 2) + rect(80, FLOOR - 8, 140, 8, DARK, 3)
        piv = (186, 160)
        roll = (ank[0] + 7, ank[1] + 3) if True else ank
        m += circle(piv, 7, DARK) + line(piv, (roll[0] - 4, roll[1]), 7, METAL) + circle(roll, 8, '#1f2328')
        m += stack(250, 70, 40)
        return scene(m, f.svg())
    return lambda: (pose(False), pose(True))

def sissy():
    def pose(down):
        ank = (175, AY - 3)
        if not down:
            f = Fig((172, AY - 88), -90, ankle=ank, foot=0, hand=(212, 118), elbow='down')
        else:
            hip = (150, 168)
            f = Fig(hip, -112, head=-95, ankle=ank, foot=35, hand=(212, 120), elbow='down')
        m = rect(214, 40, 8, FLOOR - 40, DARK, 2) + rect(190, FLOOR - 6, 60, 6, DARK, 2)
        return scene(m, f.svg())
    return lambda: (pose(False), pose(True))

def cable_knee_ext():
    def pose(up):
        hip = (175, AY - 87)
        ank = (155, 175) if not up else (205, 192)
        f = Fig(hip, -88, ankle=ank, ankle2=(177, AY), knee='fwd' if up else 'down', foot=60 if not up else 10,
                hand=(232, 110), elbow='down')
        m = column(40, 40, 26) + rect(234, 40, 8, FLOOR - 40, DARK, 2)
        return scene(m, cable((66, FLOOR - 10), f.ank), f.svg())
    return lambda: (pose(False), pose(True))

EX = {
    'cua-p1-1': back_squat(),
    'cua-p1-2': back_squat(front_bar=True),
    'cua-p1-3': back_squat(frame=smith(130, 250), dx=6),
    'cua-p1-4': hack(),
    'cua-p1-5': hack(rail=-108, travel=48, pend=True),
    'cua-p1-6': belt_squat(),
    'cua-p1-7': press45(),
    'cua-p2-1': press45(narrow=True),
    'cua-p2-2': press45(single=True),
    'cua-p2-3': bulgarian(),
    'cua-p2-4': bulgarian(smith_bar=True),
    'cua-p2-5': lunge(),
    'cua-p2-6': stepup(),
    'cua-p2-7': goblet(),
    'cua-p3-1': leg_ext(),
    'cua-p3-2': leg_ext(single=True),
    'cua-p3-3': sissy(),
    'cua-p3-4': cable_knee_ext(),
    'cua-p4-1': press45(),
    'cua-p4-2': leg_ext(),
}
