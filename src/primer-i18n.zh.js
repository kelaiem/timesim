// §95 tier two — CHINESE. primer.html's prose, keyed by the English source
// (normalized innerHTML for rich blocks, text for plate labels); see
// src/page-i18n.js for the mechanism and src/primer-i18n.js for this page's
// number rule.
//
// Vocabulary is the same register tier one's chrome and the explainer use
// (src/i18n.js, src/explain-i18n.zh.js). The going train is named as Chinese
// horology names it -- 头轮, 中心轮, 三轮, 秒轮, 擒纵轮.
//
// NUMBERS: zh-CN groups with ',' and points with '.', exactly as English does,
// so the digits here READ the same -- but they are checked by VALUE, not by
// glyph (see src/primer-i18n.js). The rule is the page's, not the locale's:
// this page quotes no identifiers, so its numbers are quantities.
//
// EDITING THE ENGLISH INVALIDATES ITS TRANSLATION, ON PURPOSE: the key stops
// matching and that block renders English until someone re-translates it.
// Never retype a key -- `node tools/explain-i18n.mjs --extract --page primer`
// regenerates them from the DOM.
export default {

  // ---- page ----
  ['Watch Sim — A Primer']: 'Watch Sim — 入门讲解',
  ['← the movement']: '← 返回机芯',
  ['want the numbers? →']: '想看具体数字？→',
  ['quantities rounded, with units · no source identifiers']: '数值取整并带单位 · 不引用任何源码标识符',
  ['What you are looking at is a <b>fusee-and-chain watch movement</b>: a machine that stores a day\'s energy in a bent ribbon of steel and spends it five clicks at a time, on the say-so of a wheel that swings back and forth two and a half times a second. This page explains how, for a reader with a little physics and no horology. Every quantity here is rounded and carries its unit; none of it requires the source code. The companion page — <a href="./explain.html">Mechanisms</a> — is the opposite document: the same machine with every number quoted exactly from the source, for readers who want to check.']:
    '您看到的是一枚<b>塔轮链条式机械机芯</b>：它把一整天的能量存进一条弯曲的钢带，再以每次五下的节奏放出来——而发号施令的，是一只每秒往复摆动两次半的轮子。本页解释它如何做到，面向只有一点物理基础、完全不懂钟表的读者。此处每个数值都已取整并标注单位，读它不需要任何源码。姊妹页面<a href="./explain.html">机构原理</a>则是相反的文档：同一台机器，每个数字都精确引自源码，供想要核对的读者。',
  ['<div class="sheet"> This page is maintained with the movement, in plain quantities — rounded, with units, and free of source identifiers by contract (a check enforces it). For the same mechanisms with every number quoted exactly from the source, see <a href="./explain.html">Mechanisms — how they work</a>. This project was made possible by <b>Claude</b>, Anthropic\'s AI model: the movement, its instruments and these pages were designed and built in collaboration with it. </div>']:
    '<div class="sheet"> 本页与机芯一同维护，只用朴素的量——取整、带单位，并按约定不含任何源码标识符（有一项检查在把关）。若想看同样这些机构、而每个数字都精确引自源码，请看<a href="./explain.html">机构原理 — 工作原理</a>。本项目由 Anthropic 的 AI 模型 <b>Claude</b> 促成：机芯、它的检测仪器以及这些页面，都是与它协作设计并搭建的。 </div>',

  // ---- energy ----
  ['Wind a watch and you are bending steel. The mainspring is a long, thin ribbon coiled inside a drum: its outer end is riveted to the drum wall, its inner end is hooked to a shaft that stands still. Winding does not <em>rotate</em> the spring so much as change its <em>shape</em> — the same length of ribbon crowds into tight turns near the centre, and the energy of a wind is stored the way a drawn bow stores it, in elastic bending all along the ribbon\'s length.']:
    '给表上弦，就是在弯曲钢材。发条是一条盘在条盒里的细长钢带：外端铆在条盒壁上，内端挂在一根静止不动的条轴上。因此上弦与其说是让发条<em>转动</em>，不如说是改变它的<em>形状</em>——同一段钢带被挤进靠近中心的密集圈层，一次上弦的能量便像拉满的弓那样，以弹性弯曲的形式分布在整条钢带上。',
  ['As the watch runs, the ribbon relaxes turn by turn and its stored energy flows out through the drum. One full wind here holds about <b>30 hours</b> of running, and the machinery spends it very slowly: the first wheel of the gear train makes one revolution every 17 1/7 hours — one and three-quarter turns over the whole reserve. Everything faster than that is gearing, which has its own entry below.']: '走时过程中，钢带一圈一圈松开，储存的能量经条盒流出。此处满弦约可维持 <b>30 小时</b>；机构花得极慢：轮系的第一只轮每 17 1/7 小时才转一圈——整段储备下来是一又四分之三圈。比它更快的一切都来自齿轮传动，那是下面自己的条目。',
  ['Honesty note: the ribbon in the simulation is not a decoration. Its shape is recomputed as the wind changes, under two constraints a real spring obeys — neighbouring turns may touch but never merge, and every shape must be the same length of steel, because steel does not stretch. The picture of a wound spring bunched at the centre and a spent one spread against the wall is the geometry those two rules force.']:
    '诚实说明：仿真中的这条钢带不是装饰。它的形状随上弦状态重新计算，并服从真实发条的两条约束——相邻圈层可以相贴但绝不相融，而每一种形状都必须是同样长度的钢材，因为钢不会变长。满弦时钢带挤在中心、放完时铺向外壁，这幅图景正是这两条规则逼出来的几何。',
  ['Where the energy comes from<span class="where">power</span>']: '能量从哪里来<span class="where">动力</span>',

  // ---- fusee ----
  ['A spring\'s pull is not constant: freshly wound it is strong, nearly spent it is weak. A timekeeper hates that, because the size of the push reaching the balance changes how it swings. The classical fix — this movement\'s namesake — is the <b>fusee</b>: a cone-shaped pulley connected to the spring\'s drum by a miniature chain — built like a bicycle chain, with links well under a millimetre long.']:
    '发条的拉力并不恒定：刚上满时强，快放完时弱。走时机构讨厌这一点，因为传到摆轮的推力大小会改变它的摆幅。经典的补救办法——也正是这枚机芯的名字所指——就是<b>塔轮</b>：一只圆锥形的绳轮，用一条极细的链条与发条条盒相连——结构如同自行车链条，只是每一节都远不到一毫米长。',
  ['The trick is leverage. Torque — turning force — is pull times lever arm. When the spring is strong, the chain pulls on the cone\'s <em>narrow</em> end: big pull, short lever. As the spring runs down, the chain walks along the cone\'s spiral groove toward the <em>wide</em> end: smaller pull, longer lever. The product, the torque handed to the gears, stays nearly level from full wind to empty.']:
    '诀窍在于杠杆。力矩——也就是转动的力——等于拉力乘力臂。发条强时，链条作用在锥体的<em>细</em>端：拉力大，力臂短。发条放松后，链条沿锥体的螺旋沟槽走向<em>粗</em>端：拉力小，力臂长。两者之积，也就是交给轮系的力矩，从满弦到放尽几乎不变。',
  ['The cone is cut against the spring\'s own measured decline, so the two curves cancel. The chain also explains the winding feel of such watches: winding spools the chain back from drum to cone, and a small detent keeps the gears driven during the seconds the wind would otherwise unload them.']:
    '锥体的轮廓正是照着发条自身实测的衰减曲线车出来的，两条曲线因而互相抵消。链条也解释了这类表上弦时的手感：上弦把链条从条盒卷回锥体，而一枚小小的止动机构会在上弦短暂卸载轮系的那几秒里，继续维持它被驱动。',
  ['The fusee — evening out a dying spring<span class="where">power</span>']: '塔轮 —— 把渐弱的发条抹平<span class="where">动力</span>',
  ['Pull × lever arm ≈ constant']: '拉力 × 力臂 ≈ 常数',
  ['PLATE 1']: '图版 1',
  ['freshly wound']: '刚上满弦',
  ['short lever']: '短力臂',
  ['strong pull']: '拉力强',
  ['big pull × small radius']: '大拉力 × 小半径',
  ['nearly run down']: '接近放尽',
  ['long lever']: '长力臂',
  ['weak pull']: '拉力弱',
  ['small pull × big radius']: '小拉力 × 大半径',
  ['≈ the same torque']: '≈ 同样的力矩',

  // ---- gears ----
  ['Everything between the drum and the ticking is multiplication. When a wheel with many teeth drives a small pinion, the pinion turns faster in exact proportion to the tooth counts — a wheel of 120 teeth driving a pinion of 7 turns it exactly 17 1/7 times per revolution, and there is nothing more to know. Speed is bought at the price of force, the same trade as a bicycle\'s gears.']: '从条盒到滴答之间的一切都是乘法。当一只多齿的轮驱动一只小齿轮时，小齿轮转快的倍数恰好等于齿数之比——一只 120 齿的轮带动 7 齿的小齿轮，每转一圈就把它带转整整 17 1/7 圈，除此之外没有别的门道。速度是用力换来的，和自行车换挡是同一笔买卖。',
  ['Four such steps stand between the power and the escapement. The last three you can check on your fingers: 7½ × 8 × 10 = 600, which is exactly one turn per hour becoming one turn every 6 seconds. The first step is the odd fraction, × 17 1/7: the "great wheel", riding on the fusee cone itself, turns once in 17 1/7 hours, and its 120 teeth driving a 7-leaf pinion hand the centre wheel its once-per-hour turn. That gearing was chosen for the chain\'s sake — spreading the 30-hour reserve over fewer, wider-spaced turns of groove is what gives every link room to sit flat against the cone instead of perching on a corner.']: '动力与擒纵之间隔着四级这样的传动。后三级您能掰着手指核对：7½ × 8 × 10 = 600，恰好是每小时一圈变成每 6 秒一圈的倍数。第一级是那个不整的分数，× 17 1/7：骑在塔轮锥体上的“头轮”每 17 1/7 小时转一圈，它的 120 齿带动 7 叶小齿轮，把每小时一圈交给中心轮。这个配齿是为链条选的——把 30 小时的储备摊在更少、间距更宽的沟槽圈上，正是让每一节链都能平贴在锥面上、而不是踮在棱角上的原因。',
  ['The hour hand is one more piece of the same arithmetic. A small gear turning with the minute hand drives a wheel three times its size, and a pinion on that wheel drives the hour wheel at 4:1 more — 3 × 4 = <b>12:1</b>, which is why the hour hand makes one circuit while the minute hand makes twelve. In this simulation that ratio is never written down anywhere: it emerges because those four tooth counts multiply to it, exactly as in the metal.']:
    '时针不过是同一套算术再走一步。与分针同轴的一只小轮带动一只三倍大的轮，而那只轮上的小齿轮又以 4:1 带动时轮——3 × 4 = <b>12:1</b>，这就是时针走一圈、分针走十二圈的原因。在这套仿真里，这个比值哪里都没有写下来：它是那四个齿数相乘的结果，与金属里一模一样。',
  ['Two of the train\'s wheels double as the display: the centre wheel turns once an hour and carries the minute hand; the fourth wheel turns once a minute and carries the seconds hand. No hand is ever <em>told</em> where to point — its angle arrives through the teeth.']:
    '轮系中有两只轮同时兼作显示：中心轮每小时转一圈，带着分针；秒轮每分钟转一圈，带着秒针。任何一根指针都从未被<em>告知</em>该指向哪里——它的角度是穿过轮齿传来的。',
  ['Gears are arithmetic<span class="where">power → display</span>']: '齿轮就是算术<span class="where">动力 → 显示</span>',
  ['One turn in 17 1/7 hours becomes one turn in 6 seconds']: '17 1/7 小时一圈，变成 6 秒一圈',
  ['great wheel · 120 teeth']: '头轮 · 120 齿',
  ['1 turn / 17 1/7 h']: '1 圈 / 17 1/7 小时',
  ['× 17 1/7']: '× 17 1/7',
  ['× 8']: '× 8',
  ['centre wheel']: '中心轮',
  ['1 turn / hour']: '1 圈 / 小时',
  ['carries the minute hand']: '带动分针',
  ['× 7½']: '× 7½',
  ['third wheel']: '三轮',
  ['fourth wheel']: '秒轮',
  ['1 turn / minute']: '1 圈 / 分钟',
  ['carries the seconds hand']: '带动秒针',
  ['× 10']: '× 10',
  ['escape wheel']: '擒纵轮',
  ['1 turn / 6 s']: '1 圈 / 6 秒',

  // ---- escapement ----
  ['Left alone, the gear train would spin the whole reserve away in moments. The <b>escapement</b> is the checkout counter: it lets the train advance one fixed step at a time, and only when the timekeeper says so. Its three players are the escape wheel (the train\'s last, fastest wheel), a see-sawing lever with two jewelled pallet stones, and the balance — the swinging wheel of the next entry.']:
    '若无人看管，轮系会在片刻之间把整段储备空转掉。<b>擒纵机构</b>就是那道收银台：它让轮系每次只前进固定的一步，而且只在走时机构点头时才放行。它的三位角色是擒纵轮（轮系最后、也最快的一只轮）、一只带两颗宝石瓦的翘板式擒纵叉，以及摆轮——下一条目里那只摆动的轮子。',
  ['Most of the time the escape wheel is simply <em>held</em>: a tooth presses on a stone, and the geometry of the stone\'s face is angled so that the pressure locks it tighter rather than slipping — like a door wedge that a push only seats deeper. When the swinging balance flicks the lever, the stone lifts, the wheel escapes forward by <b>12°</b> — half a tooth spacing, no more, because the lever\'s other stone is already in the way — and in that brief slide the tooth\'s face pushes on the stone, handing the balance a small shove that pays back what friction and air took from its swing. Then the wheel is caught again, and waits.']:
    '大部分时间里，擒纵轮只是被<em>锁住</em>：一枚轮齿压在瓦石上，而瓦石的锁面有意做成一定倾角，使这份压力把它锁得更紧而不是让它滑脱——就像一只门楔，越推越吃进去。当摆动的摆轮拨动擒纵叉，瓦石抬起，轮子向前逃逸 <b>12°</b>——恰好半个齿距，不多不少，因为另一颗瓦石已经等在那里——就在这短短一滑之间，齿面推在瓦石上，给摆轮一记小小的推送，补回摩擦与空气从它摆幅中拿走的那一份。随后轮子重新被扣住，继续等待。',
  ['That cycle is the tick: <b>5 per second</b> here, 18,000 per hour, each one an unlock–slide–catch. The wheel is in motion for only about a sixth of each beat — a watch is a machine that is almost always standing still.']:
    '这个循环就是滴答：此处每秒 <b>5 次</b>，每小时 18,000 次，每一次都是解锁—滑移—扣住。轮子每个摆动周期里只有约六分之一的时间在动——机械表是一台几乎总在静止的机器。',
  ['Two ideas travel through one contact, in opposite directions. Energy flows outward: train → wheel → stone → lever → balance, a shove per beat. Position flows inward: the wheel stands where the stones allow, so the balance — not the spring in the drum — decides what time it is.']:
    '两件事沿同一处接触向相反方向传递。能量向外流：轮系 → 擒纵轮 → 瓦石 → 擒纵叉 → 摆轮，每拍一记推送。位置则向内传：轮子停在瓦石允许它停的地方，所以决定现在几点的是摆轮，而不是条盒里的发条。',
  ['The escapement — spending energy five clicks a second<span class="where">timekeeping</span>']: '擒纵机构 —— 每秒五下地花掉能量<span class="where">走时</span>',
  ['Held, then let go — one step at a time']: '先扣住，再放行 —— 一次一步',
  ['locked — most of the beat']: '锁住 —— 一拍中的绝大部分',
  ['stone holds the tooth']: '瓦石扣住轮齿',
  ['pressure seats it deeper']: '压力把它压得更深',
  ['the train pushes; nothing moves']: '轮系在推；什么也没动',
  ['impulse — a sixth of the beat']: '传冲 —— 一拍的六分之一',
  ['tooth shoves the stone,']: '轮齿推动瓦石，',
  ['flicking lever + balance']: '带动擒纵叉与摆轮',
  ['the wheel advances 12° and is caught']: '轮子前进 12° 后被扣住',

  // ---- balance ----
  ['The timekeeper itself is the <b>balance</b>: a weighted rim on pivots, with a spiralled hairspring that twists as the rim turns and pushes it back toward centre. Twist it further, and the spring pushes back harder — restoring torque proportional to angle. Newton\'s law for rotation then gives the balance\'s angular acceleration as spring stiffness over rotational inertia, times the angle — and that equation is the same one a mass on a spring obeys. Its solution is a steady oscillation whose frequency depends on exactly two things: the <em>stiffness</em> of the spring and the <em>inertia</em> of the wheel. Frequency is the square root of stiffness over inertia — and nothing else.']:
    '走时机构本身就是<b>摆轮</b>：一圈带配重的轮缘架在轴尖上，配一根盘成螺旋的游丝；轮缘转动时游丝被扭紧，把它推回中位。扭得越多，游丝回推得越狠——回复力矩与角度成正比。把牛顿定律用到转动上，摆轮的角加速度就等于游丝刚度除以转动惯量再乘以角度——而这与弹簧上一个质点所服从的方程完全相同。它的解是一段匀稳的振动，频率只取决于两样东西：游丝的<em>刚度</em>与轮子的<em>惯量</em>。频率等于刚度除以惯量再开平方——此外别无他物。',
  ['The remarkable consequence: the <em>amplitude is not in the formula</em>. Swing the balance wide or barely at all and each swing takes the same time — a big swing moves faster through a longer arc, and the two effects cancel. That property, called <b>isochronism</b>, is why a watch can keep time while its mainspring\'s push (and so its balance\'s swing) sags across 30 hours. Galileo noticed it in a swinging lamp; every mechanical watch since is a bet placed on it.']:
    '由此得到一个了不起的推论：<em>振幅不在公式里</em>。让摆轮大幅摆动还是几乎不动，每一次摆动所用的时间都一样——摆得大就走得快、弧也更长，两者恰好抵消。这一性质叫作<b>等时性</b>，它正是一枚表能在发条推力（连带摆轮摆幅）历经 30 小时衰减的同时仍然守时的原因。伽利略从一盏摇晃的吊灯上注意到它；此后每一枚机械表都是押在它身上的一注。',
  ['The physics also says how to <em>adjust</em> such a watch. This balance is "free-sprung": nothing ever pinches or shortens the hairspring. Instead the rim carries threaded timing screws — screw a pair inward and the rim\'s mass moves toward the axis, the inertia drops, and the watch runs faster; outward, slower. Rate lives in the denominator of that square root.']:
    '物理同样告诉我们该如何<em>调校</em>这样一枚表。这只摆轮是“无卡度”的：任何东西都不会夹住或缩短游丝。取而代之的是轮缘上旋着的一圈调速螺钉——把一对往里旋，轮缘的质量就向轴心靠拢，惯量下降，表走快；往外旋则走慢。快慢就住在那个平方根的分母里。',
  ['Honesty note: in this simulation the spring is real arithmetic, not a prop. The wheel\'s inertia is computed from its drawn dimensions — about 85% of it in the rim, a tenth in the screws, the rest in the arms — and the hairspring\'s cross-section is then <em>solved</em> so that the square root lands exactly on the advertised rate. The ribbon that comes out of the solve is about 0.024 mm thick, inside the 0.02–0.04 mm range real hairspring stock is drawn in. The one liberty is the drawn amplitude, above.']:
    '诚实说明：在这套仿真里，游丝是真的在算，而不是一件道具。轮子的惯量由它自己画出来的尺寸称得——其中约 85% 在轮缘，十分之一在螺钉，其余在轮辐——游丝的<em>截面</em>随后被反解出来，使那个平方根恰好落在标称频率上。解出来的这条带子厚约 0.024 mm，正处在真实游丝钢带 0.02–0.04 mm 的常用区间内。唯一的自由发挥是上面画出来的摆幅。',
  ['Here the balance completes 2½ full oscillations per second, and each oscillation crosses the escapement twice — once each way — giving the 5 ticks per second of the previous entry. A healthy real balance swings roughly three-quarters of a turn each way; on screen the swing is drawn smaller than life so the beat stays readable at a glance.']:
    '此处摆轮每秒完成 2½ 次完整振动，而每次振动两次穿过擒纵机构——来回各一次——于是得到上一条目里每秒 5 下的滴答。真实状态良好的摆轮每侧大约摆过四分之三圈；屏幕上的摆幅被画得比实物小，好让节拍一眼就能看清。',
  ['Why the balance keeps time<span class="where">timekeeping</span>']: '摆轮为什么能守时<span class="where">走时</span>',
  ['Big swing or small — the same time per swing']: '摆得大还是小 —— 每次摆动用时相同',
  ['wide swing']: '大摆幅',
  ['long arc, high speed']: '弧长，速度高',
  ['narrow swing']: '小摆幅',
  ['short arc, low speed']: '弧短，速度低',
  ['same period —']: '周期相同 ——',
  ['2½ swings per second']: '每秒 2½ 次摆动',

  // ---- keyless ----
  ['The crown at the movement\'s edge does two unrelated things — winds the spring, sets the hands — and the mechanism that decides which is a small axial clutch on the crown\'s stem. Pushed home, the stem\'s gear engages the winding path: each turn of the crown spools chain back onto the fusee cone, storing energy. Pulled out one stop, a pivoting lever slides that gear a couple of millimetres along the stem into the setting path, where it reaches the hand wheels instead.']:
    '机芯边缘的表冠要做两件毫不相干的事——上弦与拨针——而决定此刻做哪一件的，是柄轴上一只小小的轴向离合。表冠推到底时，柄轴上的齿轮接入上弦一路：每转一下表冠，就把链条卷回塔轮锥体，把能量存起来。向外拉出一档，一只摆动的拨杆便把同一只齿轮沿柄轴推移几毫米，接入拨针一路，改而够到指针轮系。',
  ['One crown, two jobs<span class="where">interface</span>']: '一只表冠，两项差事<span class="where">操作</span>',

  // ---- alarm ----
  ['This movement carries a complete second power system for its alarm, with its own crown, its own barrel-spring, and its own release. The alarm crown does for the alarm what the main crown does for the time: turned one way it sets a disc under the dial to the chosen alarm time (a central alarm hand shows it, riding beneath the hour hand); pushed home it winds the alarm\'s own spring.']:
    '这枚机芯为闹响配了一整套第二动力系统，有自己的表冠、自己的条盒发条和自己的释放机构。闹响表冠之于闹铃，正如主表冠之于时间：朝一个方向转动，把表盘下的一只圆盘拨到所选的闹响时刻（一根中央闹针指示它，藏在时针之下）；推回到底，则给闹铃自己的发条上弦。',
  ['The release is a mechanical comparison, made by touch. A spring-loaded finger — the <b>feeler</b> — rests against the edge of the rotating alarm disc, which turns with the hours. The disc\'s edge carries a notch at the set time; everywhere else the feeler rides the high rim and the alarm stays blocked. When the dial\'s time reaches the set time, the notch arrives under the feeler, the feeler drops in, and the block is withdrawn: the alarm spring is free to run. It spins a small train that swings a hammer against a gong, and rings until the spring is spent — or until a pull of the alarm crown lifts the feeler out and parks it.']:
    '释放是一次机械式的比对，靠触觉完成。一枚受簧力压着的手指——<b>触杆</b>——抵在随小时转动的闹响圆盘边缘上。圆盘边缘在设定时刻处开有一道缺口；其余各处触杆都骑在高起的边沿上，闹铃保持锁止。当表盘的时间走到设定时刻，缺口转到触杆之下，触杆落入其中，锁止随之撤去：闹铃发条得以奔跑。它带动一列小轮系，把音锤挥向音簧，一直响到发条耗尽——或者直到有人拉出闹响表冠，把触杆抬出并停放好。',
  ['Arming is its own little machine: pressing the pusher ratchets a star-shaped column wheel round one tooth per press, alternately enabling and disabling the release — the same switch-by-column that chronograph buttons use.']:
    '启动闹响本身是一台小机器：按下按钮，棘爪就把一只星形柱轮推过一齿，于是释放机构被交替地开启和关闭——与计时码表按钮所用的柱轮切换是同一套办法。',
  // ---- §104: the ringing is driven now ----
  ['Honesty note, both directions. The arming chain is genuinely <em>driven</em>: the press moves the pawl, the pawl indexes the column, and every part downstream stands where the surface pushing it puts it — the simulation measures every one of those contacts closed on every test run. The ringing now is too: the hammer\'s <em>tempo</em> is derived from the spring\'s torque through the speed limiter real alarms use — a small anchor fluttering on a toothed wheel, its balancing ring sized by arithmetic — so the bell starts brisk on a full spring and audibly slows as it spends, stopping at a floor the spring\'s pre-tension sets instead of trailing off. What the debt list still records here: the hammer\'s own fall is timed from the strike schedule, not yet from its blade\'s stiffness.']: '诚实说明，两个方向都说。启动这条链路确实是被<em>驱动</em>的：按压带动棘爪，棘爪把柱轮推过整整一齿，其后的每一个零件都停在推动它的那个面所决定的位置上——每次测试运行，仿真都会把这些接触逐一测为闭合。响铃如今也是如此：音锤的<em>快慢</em>由发条力矩推导而来，经过真实闹钟所用的那种限速器——一只在齿轮上振动的小锚，配重环按算术定尺——于是铃声在满弦时急促，随发条耗尽而可闻地放慢，最后停在发条预紧设定的下限上，而不是渐渐没了声息。欠账清单在这里仍记着的是：音锤自身的下落仍按打点节奏计时，尚未来自其簧片的刚度。',
  ['The gap between those words is where simulations usually lie, and this one keeps a public ledger of exactly that gap. The hands are simulated — their angles arrive through tooth counts, never assigned. The arming run is simulated — measured contact by contact. The hairspring\'s stiffness is modelled honestly enough that the beat follows from it as arithmetic, and the alarm\'s ringing tempo — for a long time the ledger\'s standing example of a merely authored number — is now derived the same way, from its own spring through a governor. The ledger did not empty, it moved: the hammer\'s fall is still timed rather than sprung, and the debt list says so in writing rather than letting the animation imply otherwise.']: '仿真通常正是在这两个词之间的缝隙里说谎，而本项目为这道缝隙留着一份公开的账。指针是已仿真的——它们的角度经齿数传来，从不被赋值。启动闹响的那条链路是已仿真的——逐个接触实测。游丝的刚度建模得足够诚实，以至于振频是从中算出来的；而闹响的敲击快慢——长期作为这本账上「仅是写定之数」的现成例子——如今也以同样的方式推导而来，出自它自己的发条，经过一只调速器。这本账没有清空，只是搬了家：音锤的下落仍是计时而非簧驱，欠账清单白纸黑字写着这一点，而不是任由动画去暗示别的。',
  ['The alarm — a second spring with a voice<span class="where">alarm</span>']: '闹响 —— 会发声的第二根发条<span class="where">闹响</span>',

  // ---- gong ----
  ['The alarm\'s voice is a steel bar clamped at one end — a stiff one-sided beam the hammer strikes near its foot. Strike any such bar and it rings at several frequencies at once: the fundamental, plus overtones whose positions are fixed by the physics of a bending beam, not by any tuner. For a clamped-free bar the second mode lands at about <b>6.3×</b> the fundamental — not 2×, not 3×, nothing on the musical ladder. Overtones that miss the whole-number rungs are what your ear calls "metallic"; a guitar string\'s overtones land exactly on them, which is why a string is a note and a struck bar is a <em>clang</em>.']:
    '闹铃的嗓音来自一根一端夹紧的钢棒——一根单端固定的刚性梁，音锤敲在靠近根部的位置。敲击这样一根棒，它会同时以若干频率鸣响：基频，再加上若干泛音，而泛音的位置由弯曲梁的物理定律定死，不由任何调音师决定。对一端夹紧的棒来说，第二阶振型落在基频的约 <b>6.3×</b> 处——不是 2×，也不是 3×，不落在音乐音阶的任何一级上。恰好错开整数级的泛音，正是您的耳朵所谓的“金属味”；吉他弦的泛音精确落在这些整数级上，所以弦发出的是一个音，而被敲响的棒发出的是一记<em>哐当</em>。',
  ['In the simulation the sound is synthesised from the drawn bar itself: its length and thickness set the fundamental, the beam equation sets the overtone ratios, and shortening the bar raises every partial together — exactly as filing a real gong would. Nothing about the sound is a recording, and no frequency is picked by hand.']:
    '仿真中的声音是从画出来的这根棒本身合成的：它的长度与粗细定下基频，梁方程定下泛音比例，把棒截短则所有分音一起升高——与锉短一根真实音簧完全一样。声音里没有任何一段录音，也没有任何一个频率是手工挑的。',
  ['Why the gong sounds like metal, not music<span class="where">alarm</span>']: '音簧为什么听起来像金属而不像音乐<span class="where">闹响</span>',

  // ---- honesty ----
  ['This project polices its own language, and the primer is bound by the same rule as everything else. Two words are used precisely. <b>Modelled</b> means <em>described</em>: the geometry exists, its dimensions are derived from stated constraints, and instruments check the description for contradictions. <b>Simulated</b> means <em>driven</em>: the part moves because another part pushes it, cause to effect through real contacts — not because an animation poses it where the answer should be.']:
    '本项目对自己的用词是有纪律的，这份入门讲解与其他一切受同一条规则约束。有两个词被精确使用。<b>已建模</b>意为<em>被描述</em>：几何存在，其尺寸由明说的约束推导而来，并有仪器检查这份描述有无自相矛盾。<b>已仿真</b>意为<em>被驱动</em>：零件之所以动，是因为另一个零件推了它，因果经由真实接触传递——而不是因为一段动画把它摆到答案应该在的地方。',
  ['If a claim on this page overstates what the machine underneath actually does, that is a bug in this page — the ledger, not the prose, is the record.']:
    '若本页的某项说法夸大了底下那台机器实际所做的事，那是本页的错误——留作记录的是那份欠账清单，而不是这些文字。',
  ['What this simulation claims — and what it doesn\'t<span class="where">the rules</span>']: '这套仿真主张什么 —— 又不主张什么<span class="where">规则</span>',
};
