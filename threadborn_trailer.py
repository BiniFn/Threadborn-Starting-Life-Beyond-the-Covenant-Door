from manim import *
import random, math

# ═══════════════════════════════════════════════════════════════════
#  THREADBORN — Trailer  (clean & cinematic)
#  Run: manim -pqh threadborn_trailer.py Trailer
# ═══════════════════════════════════════════════════════════════════

BG    = "#07070D"
PALE  = "#EEEEFF"
GOLD  = "#D4A830"
RED   = "#C02020"
VIOL  = "#9040C0"
DIM   = "#44445A"
RUNE  = "#AABBFF"


def T(t, size=36, color=PALE, italic=False):
    return Text(t, font="Georgia", font_size=size, color=color,
                slant=ITALIC if italic else NORMAL)


def flash(scene, color=RED, opacity=0.7):
    r = Rectangle(width=20, height=12,
                  fill_color=color, fill_opacity=0, stroke_width=0)
    scene.add(r)
    scene.play(r.animate.set_fill(opacity=opacity), run_time=0.05)
    scene.play(r.animate.set_fill(opacity=0.0),     run_time=0.35)
    scene.remove(r)


def stars(n=160):
    g = VGroup()
    for _ in range(n):
        g.add(Dot(
            [random.uniform(-7.5, 7.5), random.uniform(-4.5, 4.5), 0],
            radius=random.uniform(0.01, 0.04),
            color=random.choice([PALE, GOLD, RUNE]),
            fill_opacity=random.uniform(0.2, 0.85)
        ))
    return g


class Trailer(Scene):

    def construct(self):
        self.camera.background_color = BG
        self._s01_open()
        self._s02_thread_web()
        self._s03_nodes()
        self._s04_unraveling()
        self._s05_yono()
        self._s06_black_hall()
        self._s07_powers()
        self._s08_violet()
        self._s09_montage()
        self._s10_title()

    # ── S01  Cold open ─────────────────────────────────────────────
    def _s01_open(self):
        self.add(stars(180))

        # single expanding ring
        ring = Circle(radius=0.08, color=GOLD,
                      stroke_opacity=0.8, stroke_width=1.8, fill_opacity=0)
        self.add(ring)
        self.play(ring.animate.scale(80).set_stroke(opacity=0),
                  run_time=2.0, rate_func=rush_into)
        self.remove(ring)

        title = T("THREADBORN", size=86, color=PALE)
        title.set_stroke(color=GOLD, width=1.8)
        self.play(FadeIn(title, scale=0.88, run_time=0.4))
        self.wait(0.6)
        self.play(FadeOut(title, scale=1.1, run_time=0.45))
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.4)

    # ── S02  Thread web ────────────────────────────────────────────
    def _s02_thread_web(self):
        # 7 nodes, clean web
        pos = [
            ORIGIN,
            UP*1.9, DOWN*1.9,
            LEFT*3.0 + UP*0.7,  RIGHT*3.0 + UP*0.7,
            LEFT*3.0 + DOWN*0.7, RIGHT*3.0 + DOWN*0.7,
        ]
        dots = VGroup(*[
            Dot(p, radius=0.11 if i == 0 else 0.07,
                color=GOLD if i == 0 else PALE, fill_opacity=0.9)
            for i, p in enumerate(pos)
        ])
        pairs = [(0,1),(0,2),(0,3),(0,4),(0,5),(0,6),(1,3),(1,4),(2,5),(2,6)]
        web = VGroup(*[
            Line(pos[a], pos[b], stroke_width=1.3,
                 color=GOLD, stroke_opacity=0.42)
            for a, b in pairs
        ])

        self.play(LaggedStart(*[GrowFromCenter(d) for d in dots],
                              lag_ratio=0.07, run_time=0.9))
        self.play(LaggedStart(*[Create(l) for l in web],
                              lag_ratio=0.06, run_time=0.9))
        self.play(Flash(ORIGIN, color=GOLD, line_length=0.55,
                        num_lines=18, flash_radius=0.85, run_time=0.5))

        l1 = T("Every connection leaves a Thread.", size=28, color=PALE)
        l2 = T("Threads are the skeleton of the world.", size=22,
               color=GOLD, italic=True)
        l1.to_edge(DOWN, buff=0.8)
        l2.next_to(l1, DOWN, buff=0.28)
        self.play(FadeIn(l1))
        self.play(FadeIn(l2))
        self.wait(1.1)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

    # ── S03  Fate / Memory / Emotion / Reality ─────────────────────
    def _s03_nodes(self):
        self.add(stars(160))

        center = Dot(ORIGIN, radius=0.13, color=GOLD)
        self.play(GrowFromCenter(center, run_time=0.4))
        self.play(Flash(ORIGIN, color=GOLD, line_length=0.5,
                        num_lines=16, flash_radius=0.9, run_time=0.4))

        cfg = [
            ("FATE",    GOLD, UP   * 2.4, UP),
            ("MEMORY",  RUNE, LEFT * 3.5, LEFT),
            ("EMOTION", VIOL, DOWN * 2.4, DOWN),
            ("REALITY", RED,  RIGHT* 3.5, RIGHT),
        ]

        rings = []
        for word, color, npos, ldir in cfg:
            ring = Circle(radius=0.30, color=color,
                          fill_color=color, fill_opacity=0.25,
                          stroke_width=2.0, stroke_opacity=0.9).move_to(npos)
            line = Line(ORIGIN, npos, stroke_width=1.6,
                        color=color, stroke_opacity=0.5)
            label = T(word, size=30, color=color)
            label.next_to(ring, ldir, buff=0.22)

            rings.append(ring)
            self.play(Create(line, run_time=0.25),
                      GrowFromCenter(ring, run_time=0.25))
            self.play(FadeIn(label, shift=ldir * 0.1, run_time=0.22))

        self.play(Flash(ORIGIN, color=GOLD, line_length=1.4,
                        num_lines=28, flash_radius=2.6, run_time=0.6))
        self.wait(0.7)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

    # ── S04  The Unraveling ────────────────────────────────────────
    def _s04_unraveling(self):
        # sparse thread web
        pts = [[random.uniform(-5, 5), random.uniform(-2.8, 2.8), 0]
               for _ in range(16)]
        web = VGroup(*[
            Line(pts[i], pts[j], stroke_width=0.9,
                 color=GOLD, stroke_opacity=0.38)
            for i in range(len(pts))
            for j in range(i+1, len(pts))
            if random.random() < 0.16
        ])
        wdots = VGroup(*[Dot(p, radius=0.05, color=GOLD,
                             fill_opacity=0.7) for p in pts])

        self.play(
            LaggedStart(*[FadeIn(d) for d in wdots],  lag_ratio=0.02, run_time=0.7),
            LaggedStart(*[Create(l) for l in web],    lag_ratio=0.015, run_time=0.9),
        )

        label = T("Then came the Unraveling.", size=42, color=PALE)
        label.to_edge(DOWN, buff=0.8)
        self.play(FadeIn(label))
        self.wait(0.5)

        flash(self, RED, 0.85)
        self.play(
            *[m.animate.set_stroke(opacity=0).set_fill(opacity=0)
              for m in [*web, *wdots]],
            run_time=0.4
        )

        broken = T("The world forgot how to feel its own connections.",
                   size=26, color=DIM, italic=True)
        broken.shift(UP * 0.3)
        self.play(FadeIn(broken))
        self.wait(1.1)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

    # ── S05  Yono falls ────────────────────────────────────────────
    def _s05_yono(self):
        # minimal rain
        rain = VGroup(*[
            Line([x, y, 0],
                 [x - 0.03, y - random.uniform(0.1, 0.35), 0],
                 stroke_width=random.uniform(0.4, 1.0),
                 stroke_opacity=random.uniform(0.1, 0.45),
                 color=RUNE)
            for x, y in [(random.uniform(-7.5, 7.5),
                          random.uniform(-5, 5)) for _ in range(90)]
        ])
        self.play(FadeIn(rain, lag_ratio=0.003, run_time=0.7))

        l1 = T("Until one man",        size=46, color=PALE)
        l2 = T("fell through the gap.", size=46, color=GOLD)
        l2.next_to(l1, DOWN, buff=0.4)
        self.play(FadeIn(l1, shift=UP*0.1))
        self.play(FadeIn(l2, shift=UP*0.1))
        self.wait(0.7)
        self.play(FadeOut(l1), FadeOut(l2))

        # falling dot + trail
        dot   = Dot([0, 3.5, 0], radius=0.09, color=PALE)
        trail = Line([0, 3.5, 0], [0, 3.5, 0],
                     stroke_width=2, color=RUNE, stroke_opacity=0.5)
        self.add(trail, dot)
        self.play(
            dot.animate.move_to([0, -4.2, 0]),
            trail.animate.put_start_and_end_on([0, 3.5, 0], [0, -4.2, 0]),
            run_time=0.75, rate_func=rate_functions.ease_in_quad
        )
        self.remove(trail, dot)

        flash(self, WHITE, 1.0)

        name = T("YONO  KAZESHIMA", size=58, color=PALE)
        name.set_stroke(color=GOLD, width=1.4)
        self.play(Write(name, run_time=1.1))
        self.wait(0.9)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

    # ── S06  The Black Hall ────────────────────────────────────────
    def _s06_black_hall(self):
        # perspective corridor lines
        corridor = VGroup()
        for x in [-6, -4, -2, 0, 2, 4, 6]:
            corridor.add(Line([x, -4.5, 0], ORIGIN,
                              stroke_width=0.6, color=DIM, stroke_opacity=0.28))
            corridor.add(Line([x,  4.5, 0], ORIGIN,
                              stroke_width=0.6, color=DIM, stroke_opacity=0.28))
        self.play(LaggedStart(*[Create(l) for l in corridor],
                              lag_ratio=0.01, run_time=0.7))

        # receding gold cords
        cords = VGroup(*[
            Line([-5.6*s, 0, 0], [5.6*s, 0, 0],
                 stroke_width=max(0.5, 2.8 - i*0.42),
                 color=GOLD, stroke_opacity=min(0.9, 0.85 - i*0.11))
            for i, s in enumerate([1.0, 0.70, 0.48, 0.32, 0.20, 0.12])
        ])
        self.play(LaggedStart(*[Create(c) for c in cords],
                              lag_ratio=0.12, run_time=1.0))

        hall = T("The Black Hall.", size=44, color=PALE)
        hall.shift(UP * 2.9)
        sub = T("Every sealed cord — a version of himself", size=23,
                color=DIM, italic=True)
        sub2 = T("he decided the world didn't need yet.", size=23,
                 color=DIM, italic=True)
        sub.next_to(hall, DOWN, buff=0.28)
        sub2.next_to(sub,  DOWN, buff=0.20)

        self.play(FadeIn(hall))
        self.play(FadeIn(sub), FadeIn(sub2))
        self.wait(0.5)

        self.play(Flash(cords[0].get_center(), color=GOLD,
                        line_length=0.7, num_lines=16, flash_radius=0.9,
                        run_time=0.35))
        self.play(FadeOut(cords[0]))

        snap = T("The seals break when the reason is big enough.",
                 size=24, color=GOLD)
        snap.shift(DOWN * 2.8)
        self.play(FadeIn(snap))
        self.wait(1.0)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

    # ── S07  Power cascade ─────────────────────────────────────────
    def _s07_powers(self):
        cfg = [
            ("TIME  SLOWS",    RUNE, "His mind outruns the world."),
            ("DAMAGE  DENIED", RED,  "A hit only lands if he allows it."),
            ("RULE  MAKER",    GOLD, "He rewrites the rules of the fight."),
            ("THREAD  CUT",    PALE, "He severs the purpose from any force."),
        ]
        for title, color, sub_t in cfg:
            flash(self, color, 0.28)
            t = Text(title, font="Georgia", font_size=64, color=color)
            t.set_stroke(color=color, width=1.8)
            s = T(sub_t, size=24, color=DIM, italic=True)
            s.next_to(t, DOWN, buff=0.42)
            self.play(FadeIn(t, scale=1.1, run_time=0.2))
            self.play(FadeIn(s, run_time=0.28))
            self.wait(0.65)
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.15)

    # ── S08  Violet ────────────────────────────────────────────────
    def _s08_violet(self):
        # bloom petals only — clean
        petals = VGroup(*[
            Line(
                [math.cos(i * TAU / 24)*0.25, math.sin(i * TAU / 24)*0.25, 0],
                [math.cos(i * TAU / 24)*random.uniform(1.2, 3.2),
                 math.sin(i * TAU / 24)*random.uniform(1.2, 3.2), 0],
                stroke_width=random.uniform(0.7, 2.2),
                color=RUNE if random.random() > 0.35 else VIOL,
                stroke_opacity=0
            )
            for i in range(24)
        ])
        self.play(LaggedStart(*[
            p.animate.set_stroke(opacity=random.uniform(0.3, 0.8))
            for p in petals
        ], lag_ratio=0.025, run_time=1.0))

        name = T("VIOLET  ARDEN", size=58, color=PALE)
        name.set_stroke(color=VIOL, width=1.4)
        s1   = T("Goddess of Flowers.  38 divine concepts.", size=24, color=VIOL)
        s1.next_to(name, DOWN, buff=0.38)

        self.play(Write(name, run_time=1.1))
        self.play(FadeIn(s1))
        self.wait(0.6)

        flash(self, RUNE, 0.45)
        bloom = T("BLOOM  ABSOLUTE", size=52, color=RUNE)
        bloom.set_stroke(color=VIOL, width=1.1)
        bloom.shift(DOWN * 2.4)
        self.play(FadeIn(bloom, scale=1.1, run_time=0.35))
        self.wait(0.9)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.5)

    # ── S09  Rapid montage ─────────────────────────────────────────
    def _s09_montage(self):
        beats = [
            ("The threads chose him.",     PALE, 0.65),
            ("The seals are breaking.",    GOLD, 0.60),
            ("The latest Yono",            DIM,  0.40),
            ("is the strongest Yono.",     PALE, 0.75),
            ("Last chapter's ceiling",     DIM,  0.40),
            ("is the new floor.",          GOLD, 1.00),
            ("One more reason.",           PALE, 0.45),
            ("Always one more reason.",    GOLD, 1.15),
        ]
        for line, color, wait in beats:
            flash(self, color, 0.18)
            t = T(line, size=44, color=color)
            self.play(FadeIn(t, shift=UP*0.06, run_time=0.15))
            self.wait(wait)
            self.play(FadeOut(t, run_time=0.12))

    # ── S10  Title card ────────────────────────────────────────────
    def _s10_title(self):
        self.add(stars(200))

        # soft center glow
        self.add(Circle(radius=4.5, color=VIOL, fill_color=VIOL,
                        fill_opacity=0.14, stroke_width=0))

        # radial threads
        rays = VGroup(*[
            Line(ORIGIN,
                 [math.cos(i*TAU/32)*8.5, math.sin(i*TAU/32)*5.5, 0],
                 stroke_width=0.8, color=GOLD, stroke_opacity=0.14)
            for i in range(32)
        ])
        self.play(LaggedStart(*[Create(r, run_time=0.4) for r in rays],
                               lag_ratio=0.02))

        title = Text("THREADBORN", font="Georgia", font_size=84, color=PALE)
        title.set_stroke(color=GOLD, width=2.0)
        vol = T("Volume I  —  Reborn With Zero Dignity", size=23, color=GOLD)
        tag = T("Starting Life Beyond the Covenant Door", size=17,
                color=DIM, italic=True)
        vol.next_to(title, DOWN, buff=0.5)
        tag.next_to(vol,   DOWN, buff=0.28)

        self.play(Write(title, run_time=1.8))
        self.play(FadeIn(vol, shift=DOWN*0.1, run_time=0.6))
        self.play(FadeIn(tag, run_time=0.5))
        self.play(Flash(ORIGIN, color=GOLD, line_length=1.8,
                        num_lines=32, flash_radius=3.2, run_time=0.7))
        self.wait(2.5)

        self.play(*[FadeOut(m) for m in self.mobjects], run_time=1.3)
        end = T("Coming Soon", size=26, color=DIM, italic=True)
        self.play(FadeIn(end, run_time=0.9))
        self.wait(2.0)
        self.play(FadeOut(end, run_time=1.0))