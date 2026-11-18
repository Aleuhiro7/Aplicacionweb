"""Motor de ilustraciones: figura de perfil (mirando a la derecha) + aparatos. 360x240."""
import math
W, H, FLOOR = 360, 240, 212
L = dict(torso=58, neck=7, head=12, ua=33, fa=30, th=45, sh=43, ft=15)
SKIN, SKIN2 = '#e0ac86', '#c38f6b'
SHIRT, SHIRT2 = '#2f6fd6', '#2357ad'
SHORTS, SHORTS2 = '#1d1d22', '#121216'
SHOE, SHOE2 = '#f4f4f4', '#cfd3d8'
HAIR = '#3b2a20'
METAL, DARK, PAD, IRON = '#b9bec7', '#3a3f47', '#1f2328', '#2b2f36'

def rad(a): return math.radians(a)
def at(p, ang, l): return (p[0] + l * math.cos(rad(ang)), p[1] + l * math.sin(rad(ang)))
def ang_of(a, b): return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
def P(p): return f'{p[0]:.1f},{p[1]:.1f}'

def ik(a, t, l1, l2, bend):
    dx, dy = t[0] - a[0], t[1] - a[1]
    d = max(1e-3, min(math.hypot(dx, dy), l1 + l2 - 0.3))
    base = math.atan2(dy, dx)
    off = math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    c1 = (a[0] + l1 * math.cos(base + off), a[1] + l1 * math.sin(base + off))
    c2 = (a[0] + l1 * math.cos(base - off), a[1] + l1 * math.sin(base - off))
    key = {'fwd': lambda c: c[0], 'back': lambda c: -c[0], 'down': lambda c: c[1], 'up': lambda c: -c[1]}[bend]
    j = max((c1, c2), key=key)
    # punto final real (si el objetivo queda fuera de alcance)
    end = at(j, ang_of(j, t), l2)
    return j, end

class Fig:
    """hip, torso (ángulo), y para cada extremidad un objetivo (mano/tobillo) + dirección del codo/rodilla."""
    def __init__(self, hip, torso=-90, head=None, hand=None, hand2=None, elbow='back', elbow2=None,
                 ankle=None, ankle2=None, knee='fwd', knee2=None, foot=0, foot2=None, shoulder_off=(0, 0)):
        self.hip = hip
        self.torso_ang = torso
        self.sh = at(hip, torso, L['torso'])
        self.sh = (self.sh[0] + shoulder_off[0], self.sh[1] + shoulder_off[1])
        hd = torso if head is None else head
        self.neck = at(self.sh, hd, L['neck'])
        self.head = at(self.neck, hd, L['head'])
        self.headang = hd
        hand = hand or at(at(self.sh, 90, L['ua']), 90, L['fa'])
        hand2 = hand2 or hand
        self.elb, self.hand = ik(self.sh, hand, L['ua'], L['fa'], elbow)
        self.elb2, self.hand2 = ik(self.sh, hand2, L['ua'], L['fa'], elbow2 or elbow)
        ankle = ankle or (hip[0], FLOOR - 7)
        ankle2 = ankle2 or ankle
        self.knee, self.ank = ik(hip, ankle, L['th'], L['sh'], knee)
        self.knee2, self.ank2 = ik(hip, ankle2, L['th'], L['sh'], knee2 or knee)
        self.foot = foot; self.foot2 = foot if foot2 is None else foot2

    def leg(self, knee, ank, foot, far):
        s, sk, sh = (SHORTS2, SKIN2, SHOE2) if far else (SHORTS, SKIN, SHOE)
        mid = ((self.hip[0] + knee[0] * 1.6) / 2.6, (self.hip[1] + knee[1] * 1.6) / 2.6)
        toe = at(ank, self.foot if not far else self.foot2, L['ft'])
        return (f'<polyline points="{P(mid)} {P(knee)} {P(ank)}" stroke="{sk}" stroke-width="15"/>'
                f'<polyline points="{P(self.hip)} {P(mid)}" stroke="{s}" stroke-width="20"/>'
                f'<polyline points="{P(at(ank, (self.foot if not far else self.foot2) + 180, 3))} {P(toe)}" stroke="{sh}" stroke-width="10"/>')

    def arm(self, elb, hand, far):
        sh, sk = (SHIRT2, SKIN2) if far else (SHIRT, SKIN)
        return (f'<polyline points="{P(self.sh)} {P(elb)}" stroke="{sh}" stroke-width="14"/>'
                f'<polyline points="{P(elb)} {P(hand)}" stroke="{sk}" stroke-width="11"/>'
                f'<circle cx="{hand[0]:.1f}" cy="{hand[1]:.1f}" r="6" fill="{sk}"/>')

    def body(self):
        h = self.head; a = self.headang
        face = at(at(h, a + 90, 2.5), a + 180, 1.5)
        hip_c = at(self.hip, self.torso_ang, 4)
        chest = at(self.hip, self.torso_ang, L['torso'] * .62)
        return (f'<circle cx="{hip_c[0]:.1f}" cy="{hip_c[1]:.1f}" r="15" fill="{SHORTS}"/>'
                f'<polyline points="{P(at(self.hip, self.torso_ang, 8))} {P(self.sh)}" stroke="{SHIRT}" stroke-width="30"/>'
                f'<circle cx="{chest[0]:.1f}" cy="{chest[1]:.1f}" r="16" fill="{SHIRT}"/>'
                f'<polyline points="{P(self.sh)} {P(self.neck)}" stroke="{SKIN}" stroke-width="11"/>'
                f'<circle cx="{h[0]:.1f}" cy="{h[1]:.1f}" r="{L["head"]+1.5}" fill="{HAIR}"/>'
                f'<circle cx="{face[0]:.1f}" cy="{face[1]:.1f}" r="{L["head"]-.5}" fill="{SKIN}"/>'
                f'<circle cx="{at(h, a-90, 1)[0]:.1f}" cy="{at(h, a-90, 1)[1]:.1f}" r="3" fill="{SKIN2}"/>')

    def svg(self, mid='', front=''):
        g = '<g stroke-linecap="round" stroke-linejoin="round" fill="none">'
        far = g + self.arm(self.elb2, self.hand2, True) + self.leg(self.knee2, self.ank2, self.foot2, True) + '</g>'
        near_leg = g + self.leg(self.knee, self.ank, self.foot, False) + '</g>'
        body = g + self.body() + '</g>'
        near_arm = g + self.arm(self.elb, self.hand, False) + '</g>'
        return far + body + near_leg + mid + near_arm + front

def hair(h, a):
    # casquete de pelo en la parte de arriba/atrás de la cabeza (a = dirección cuello→cabeza)
    r = L['head'] + 1.5
    p1 = at(h, a - 100, r); p2 = at(h, a + 70, r)
    return f'M{P(p1)} A{r},{r} 0 0,1 {P(p2)} Q{P(at(h, a + 15, 4))} {P(p1)}Z'

# ---------------- aparatos ----------------
def scene(*parts, zoom=1.0, cx=180):
    body = ''.join(parts)
    if zoom != 1.0:
        body = f'<g transform="translate({cx*(1-zoom):.1f},{FLOOR*(1-zoom):.1f}) scale({zoom})">{body}</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f5"/>'
            '<stop offset="1" stop-color="#d9dee6"/></linearGradient></defs>'
            f'<rect width="{W}" height="{H}" fill="url(#bg)"/><rect y="{FLOOR}" width="{W}" height="{H-FLOOR}" fill="#9aa1ab"/>'
            + body + '</svg>')

def rect(x, y, w, h, fill=DARK, rx=3, extra=''):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" {extra}/>'
def line(a, b, w=6, c=METAL):
    return f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'
def poly(pts, fill=PAD):
    return f'<polygon points="{" ".join(P(p) for p in pts)}" fill="{fill}"/>'
def circle(c, r, fill):
    return f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r}" fill="{fill}"/>'

def plate(c, r=22):
    """Disco de barra visto de lado (de frente al disco)."""
    return circle(c, r, IRON) + circle(c, r - 5, '#3d424b') + circle(c, 4, METAL)
def barbell(c, r=22):
    return plate(c, r)
def bar_end(c):  # barra vista de lado sin discos grandes (p. ej. barra Z ligera)
    return circle(c, 12, IRON) + circle(c, 3, METAL)
def dumbbell(c, ang=0, size=1.0):
    """Mancuerna de perfil: eje corto con dos discos. ang = dirección del eje."""
    a = at(c, ang, 11 * size); b = at(c, ang + 180, 11 * size)
    s = ''
    for p in (a, b):
        s += f'<line x1="{at(p, ang + 90, 8*size)[0]:.1f}" y1="{at(p, ang + 90, 8*size)[1]:.1f}" x2="{at(p, ang - 90, 8*size)[0]:.1f}" y2="{at(p, ang - 90, 8*size)[1]:.1f}" stroke="{IRON}" stroke-width="{7*size:.1f}" stroke-linecap="round"/>'
    return line(a, b, 4 * size, '#6b727d') + s
def kettle(c):
    return circle((c[0], c[1] + 12), 11, IRON) + f'<path d="M{c[0]-6},{c[1]+4} Q{c[0]},{c[1]-8} {c[0]+6},{c[1]+4}" stroke="{IRON}" stroke-width="4" fill="none"/>'
def bench(x1, x2, top=150, legs=True):
    s = rect(x1, top, x2 - x1, 12, PAD, 5)
    if legs:
        s += rect(x1 + 8, top + 10, 8, FLOOR - top - 10, DARK, 1) + rect(x2 - 16, top + 10, 8, FLOOR - top - 10, DARK, 1)
    return s
def incline(seat_x1, seat_x2, seat_y, back_ang, back_len=78):
    """Banco con asiento + respaldo inclinado (back_ang hacia atrás-arriba, p. ej. -135)."""
    p0 = (seat_x1, seat_y); p1 = at(p0, back_ang, back_len)
    s = rect(seat_x1 - 6, seat_y, seat_x2 - seat_x1 + 6, 12, PAD, 5)
    s += line(p0, p1, 13, PAD)
    s += rect((seat_x1 + seat_x2) / 2 - 4, seat_y + 10, 8, FLOOR - seat_y - 10, DARK, 1)
    s += line(at(p0, back_ang, back_len * .6), (at(p0, back_ang, back_len * .6)[0], FLOOR), 6, DARK)
    return s
def column(x, top=30, w=24):
    return rect(x, top, w, FLOOR - top, DARK, 3) + rect(x + w / 2 - 2, top + 6, 4, FLOOR - top - 70, METAL, 1) + \
        ''.join(rect(x + 4, FLOOR - 62 + i * 8, w - 8, 6, '#6b727d', 1) for i in range(7))
def cable(pulley, hand, x_col=None):
    s = circle(pulley, 6, METAL) + circle(pulley, 2.5, DARK)
    return s + line(pulley, hand, 2, '#30343a')
def stack(x, top=50, w=40):
    return rect(x, top, w, FLOOR - top, DARK, 4) + rect(x + w / 2 - 2, top + 6, 4, 70, METAL, 1) + \
        ''.join(rect(x + 5, FLOOR - 84 + i * 10, w - 10, 8, '#6b727d', 2) for i in range(8))
def box(x, w, h):
    return rect(x, FLOOR - h, w, h, '#5b6470', 4) + rect(x, FLOOR - h, w, 5, '#6f7987', 3)
def smith(x1=120, x2=250, bar_y=None):
    s = rect(x1 - 6, 24, 8, FLOOR - 24, DARK, 1) + rect(x2 - 2, 24, 8, FLOOR - 24, DARK, 1) + rect(x1 - 6, 22, x2 - x1 + 14, 7, DARK, 2)
    return s
def mat(x1, x2):
    return rect(x1, FLOOR - 5, x2 - x1, 6, '#3f6f62', 3)
def handle(c):
    return circle(c, 4, IRON)
