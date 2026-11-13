/* ==========================================================================
   Kurtus Studio — Pixel-Art Niche Previews, Kurtus Mascot & Mini-CMD Console
   ========================================================================== */

(() => {
  "use strict";

  const PALETTE = {
    "#": "#ffffff",
    "+": "#666666",
  };

  /**
   * Renders a monochrome pixel bitmap array onto a canvas cleanly.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   * @param {string[]} rows
   * @param {number} scale
   * @param {number} padX
   * @param {number} padY
   */
  function drawBitmap(ctx, canvas, rows, scale, padX, padY) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows.length; y++) {
      const line = rows[y];
      for (let x = 0; x < line.length; x++) {
        const color = PALETTE[line[x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect((x + padX) * scale, (y + padY) * scale, scale, scale);
      }
    }
  }

  /**
   * Manages an animation loop that auto-pauses off-screen and in hidden tabs.
   */
  const loopControllers = [];

  function createVisibilityLoop(targetEl, intervalMs, onStep) {
    let timer = 0;
    let visible = true;

    function start() {
      if (timer || !visible || document.hidden) return;
      timer = window.setInterval(onStep, intervalMs);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = 0;
    }

    if (targetEl && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          visible = entries[0] ? entries[0].isIntersecting : true;
          if (visible) start();
          else stop();
        },
        { threshold: 0.05 }
      );
      io.observe(targetEl);
    }

    const ctrl = { start, stop };
    loopControllers.push(ctrl);
    return ctrl;
  }

  document.addEventListener("visibilitychange", () => {
    loopControllers.forEach((ctrl) => {
      if (document.hidden) ctrl.stop();
      else ctrl.start();
    });
  });

  /* ------------------------------------------------------------------------
     1. Pixel-Art Niche Switcher (24x12 monochrome animations at 7x scale)
     ------------------------------------------------------------------------ */

  function buildAutoFrames() {
    const spokeFrames = [
      { r7: "..##.#+.#.####.#+.#.##..", r8: ".....#..#......#..#....." },
      { r7: "..##.#.+#.####.#.+#.##..", r8: ".....#..#......#..#....." },
      { r7: "..##.#..#.####.#..#.##..", r8: ".....#.+#......#.+#....." },
      { r7: "..##.#..#.####.#..#.##..", r8: ".....#+.#......#+.#....." },
    ];
    const roadFrames = [
      "++....++....++....++....",
      ".++....++....++....++...",
      "..++....++....++....++..",
      "...++....++....++....++.",
    ];

    return spokeFrames.map((sp, i) => [
      "........................",
      ".........########.......",
      "........#...##...#......",
      ".......#....##....#.....",
      "...###################..",
      (i % 2 === 0 ? "+." : "..") + ".####################.",
      "..###.##.######.##.###..",
      sp.r7,
      sp.r8,
      "......##........##......",
      "........................",
      roadFrames[i],
    ]);
  }

  function buildMedFrames() {
    const crossLeft = [
      "............",
      ".....###....",
      ".....###....",
      ".....###....",
      "..#########.",
      "..#########.",
      "..#########.",
      ".....###....",
      ".....###....",
      ".....###....",
      "............",
      "............",
    ];
    const heartBig = [
      "............",
      "............",
      "..###.###...",
      ".#########..",
      ".#########..",
      ".#########..",
      "..#######...",
      "...#####....",
      "....###.....",
      ".....#......",
      "............",
      "............",
    ];
    const heartSmall = [
      "............",
      "............",
      "............",
      "...##.##....",
      "..#######...",
      "..#######...",
      "...#####....",
      "....###.....",
      ".....#......",
      "............",
      "............",
      "............",
    ];

    // Lub-dub rhythm: big, small, big, big
    const sequence = [heartBig, heartSmall, heartBig, heartBig];
    return sequence.map((heart) => crossLeft.map((left, y) => left + heart[y]));
  }

  function buildBeautyFrames() {
    const frames = [];
    for (let step = 0; step < 4; step++) {
      const rows = [
        "......###...............",
        ".....#####..............",
        "....#######....#####....",
      ];
      for (let y = 3; y <= 8; y++) {
        let pole = "#";
        for (let x = 0; x < 5; x++) {
          pole += (x - y + step + 12) % 4 < 2 ? "#" : "+";
        }
        pole += "#";
        const comb = y % 2 === 0 ? "#####" : "#....";
        rows.push("...." + pole + "...." + comb + "....");
      }
      rows.push(
        "....#######.............",
        ".....#####..............",
        "......###..............."
      );
      frames.push(rows);
    }
    return frames;
  }

  function buildLocalFrames() {
    const wrench = [
      "...#..#.....",
      "..##..##....",
      "..######....",
      "...####.....",
      "....##......",
      "....##......",
      "....##......",
      "...####.....",
      "..##..##....",
      "...####.....",
    ];

    const steps = [
      { win: "+", nudge: 0 },
      { win: "+", nudge: -1 },
      { win: ".", nudge: -1 },
      { win: ".", nudge: 0 },
    ];

    return steps.map(({ win, nudge }) => {
      const house = [
        "............",
        "......#.....",
        ".....###....",
        "....#####...",
        "...#######..",
        "..#########.",
        "...#######..",
        `...#${win}###${win}#..`,
        "...#######..",
        "...###.###..",
        "...###.###..",
        "............",
      ];
      const rows = [];
      for (let y = 0; y < 12; y++) {
        const wy = y - 1 - nudge;
        const right = wy >= 0 && wy < wrench.length ? wrench[wy] : "............";
        rows.push(house[y] + right);
      }
      return rows;
    });
  }

  const NICHES = {
    auto: {
      title: "Автосервисы и СТО",
      desc: "Понятный сайт-визитка для техцентра: услуги, цены, адрес и связь без лишних форм.",
      items: [
        "Понятный перечень работ и ориентиры по ценам",
        "Точный адрес, схема проезда и часы работы",
        "Прямая кнопка звонка или чата в один тап",
      ],
      frames: buildAutoFrames(),
    },
    med: {
      title: "Стоматологии и клиники",
      desc: "Аккуратный сайт-визитка: направления, врачи, цены и быстрая связь без лишнего шума.",
      items: [
        "Структура направлений и понятный прайс услуг",
        "Карточки врачей, график приёма и ответы на частые вопросы",
        "Быстрый переход в звонок, чат или на карту со смартфона",
      ],
      frames: buildMedFrames(),
    },
    beauty: {
      title: "Салоны и барбершопы",
      desc: "Чистая витрина мастеров, услуг, цен и быстрый переход к связи.",
      items: [
        "Актуальный прайс без неудобных PDF-файлов",
        "Мастера, примеры работ и атмосфера точки",
        "Кнопка чата, звонка или ваша готовая ссылка на запись",
      ],
      frames: buildBeautyFrames(),
    },
    local: {
      title: "Локальные услуги",
      desc: "Клининг, ремонт, мастерские, студии и выездные специалисты.",
      items: [
        "Сразу понятно, что делаете и в каком городе",
        "Наглядный список услуг и честная вилка цен",
        "Быстрая загрузка с мобильного и связь в один тап",
      ],
      frames: buildLocalFrames(),
    },
  };

  const nichesSection = document.getElementById("niches");
  const tabButtons = Array.from(document.querySelectorAll("[data-niche]"));
  const titleEl = document.getElementById("niche-title");
  const descEl = document.getElementById("niche-desc");
  const listEl = document.getElementById("niche-list");
  const nicheCanvas = document.getElementById("niche-canvas");
  const nicheCtx = nicheCanvas && nicheCanvas.getContext ? nicheCanvas.getContext("2d") : null;

  let activeNicheKey = "auto";
  let nicheTick = 0;

  function renderNicheCanvas() {
    if (!nicheCanvas || !nicheCtx) return;
    const data = NICHES[activeNicheKey];
    if (!data) return;
    const rows = data.frames[nicheTick % data.frames.length];
    drawBitmap(nicheCtx, nicheCanvas, rows, 7, 0, 0);
  }

  function selectNiche(key) {
    const data = NICHES[key];
    if (!data) return;
    activeNicheKey = key;
    nicheTick = 0;

    tabButtons.forEach((btn) => {
      const selected = btn.dataset.niche === key;
      btn.setAttribute("aria-selected", String(selected));
      btn.classList.toggle("is-active", selected);
    });

    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.desc;
    if (listEl) {
      listEl.innerHTML = "";
      data.items.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        listEl.appendChild(li);
      });
    }

    renderNicheCanvas();
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectNiche(btn.dataset.niche);
    });
  });

  if (nicheCtx) {
    selectNiche("auto");
    const nicheLoop = createVisibilityLoop(nichesSection, 260, () => {
      nicheTick += 1;
      renderNicheCanvas();
    });
    nicheLoop.start();
  }

  /* ------------------------------------------------------------------------
     2. Pixel Kurtus Mascot (4A sprite inside Mini-CMD welcome header)
     ------------------------------------------------------------------------ */

  const MASCOT_4A = {
    eye: { x: 2, y: 4 },
    scale: 4,
    padX: 2,
    padY: 1,
    frames: [
      [
        "...###........",
        "..#..##.......",
        "....#####...##",
        ".########..##.",
        "##.########...",
        "##.########...",
        ".########..##.",
        "..######....##",
        "...###........",
      ],
      [
        "...###........",
        "..#..##.......",
        "....#####..#..",
        ".########..#..",
        "##.########...",
        "##.########...",
        ".########..#..",
        "..######...#..",
        "...###........",
      ],
    ],
  };

  const cmdBox = document.querySelector(".cmd-box");
  const mascotCanvas = document.getElementById("cmd-mascot");
  const mascotCtx = mascotCanvas && mascotCanvas.getContext ? mascotCanvas.getContext("2d") : null;

  let mascotMood = "idle";
  let mascotMoodTimeout = 0;
  let mascotTick = 0;

  function drawMascot() {
    if (!mascotCanvas || !mascotCtx) return;
    const { scale, padX, padY, eye, frames } = MASCOT_4A;
    const frameIdx = Math.floor(mascotTick / 2) % frames.length;
    const bobY = mascotMood === "happy" ? (mascotTick % 2 === 0 ? -1 : 0) : 0;
    const isBlinking = mascotMood === "idle" && mascotTick % 14 === 13;

    drawBitmap(mascotCtx, mascotCanvas, frames[frameIdx], scale, padX, padY + bobY);

    if (isBlinking || mascotMood === "happy") {
      const fillRow = mascotMood === "happy" ? eye.y + 1 : eye.y;
      mascotCtx.fillStyle = "#ffffff";
      mascotCtx.fillRect((eye.x + padX) * scale, (fillRow + padY + bobY) * scale, scale, scale);
    }

    if (mascotMood === "error") {
      mascotCtx.fillStyle = "#a3a3a3";
      mascotCtx.fillRect(0, padY * scale, scale, scale);
      mascotCtx.fillRect(scale, padY * scale, scale, scale);
      mascotCtx.fillRect(scale, (padY + 1) * scale, scale, scale);
      mascotCtx.fillRect(scale, (padY + 3) * scale, scale, scale);
    }
  }

  function setMascotMood(mood) {
    mascotMood = mood;
    if (mascotMoodTimeout) {
      clearTimeout(mascotMoodTimeout);
      mascotMoodTimeout = 0;
    }
    drawMascot();
    if (mood !== "idle") {
      mascotMoodTimeout = window.setTimeout(() => {
        mascotMood = "idle";
        drawMascot();
      }, 2200);
    }
  }

  if (mascotCtx) {
    drawMascot();
    const mascotLoop = createVisibilityLoop(cmdBox, 280, () => {
      mascotTick += 1;
      drawMascot();
    });
    mascotLoop.start();
  }

  /* ------------------------------------------------------------------------
     3. Interactive Mini-CMD Terminal
     ------------------------------------------------------------------------ */

  // Прямые контакты (синхронизировано с блоком #contact в index.html)
  const CONTACT_CONFIG = {
    telegram: "@kkkurtus",
    email: "kurtus.studio@yandex.ru",
  };

  const helpLines = () => [
    "• Доступные команды:",
    "  demo     — как проходит запуск без предоплаты",
    "  kurtus   — почему студия так называется",
    "  stack    — на чём делаем сайты",
    "  contact  — прямые контакты для связи",
    "  clear    — очистить вывод",
  ];

  const COMMANDS = {
    help: helpLines,
    "?": helpLines,
    demo: () => [
      "• [01] Присылаете сферу, город и 2-3 пожелания.",
      "  [02] За 1-2 дня собираем живую ссылку под ваш бизнес (0 ₽).",
      "  [03] Если всё подходит — дорабатываем детали и запускаем.",
    ],
    kurtus: () => [
      "• ><(((º>   Kurtus gulliveri",
      "  Самец куртуса носит икру на лобном крючке и выхаживает",
      "  её в мутной воде, пока та полностью не созреет.",
      "  Так же с сайтом: сначала доводим до готового результата,",
      "  и только потом обсуждаем оплату.",
    ],
    stack: () => [
      "• HTML5 / CSS3 / Vanilla JS",
      "  Никаких тяжёлых конструкторов, лишних скриптов и абонентки.",
      "  Открывается мгновенно с любого мобильного интернета.",
    ],
    contact: () => [
      `• Telegram : ${CONTACT_CONFIG.telegram}`,
      `  Email    : ${CONTACT_CONFIG.email}`,
    ],
  };

  const cmdForm = document.getElementById("cmd-form");
  const cmdInput = document.getElementById("cmd-input");
  const cmdCursor = document.getElementById("cmd-cursor");
  const cmdMeasure = document.getElementById("cmd-measure");
  const cmdOutput = document.getElementById("cmd-output");
  const cmdChips = Array.from(document.querySelectorAll("[data-cmd]"));

  function syncCmdCursor() {
    if (!cmdInput || !cmdCursor || !cmdMeasure) return;
    const text = cmdInput.value;
    if (!text) {
      cmdMeasure.textContent = "";
      cmdCursor.style.left = "0px";
      return;
    }
    const caret = typeof cmdInput.selectionStart === "number" ? cmdInput.selectionStart : text.length;
    cmdMeasure.textContent = text.slice(0, caret);
    const maxOffset = Math.max(0, (cmdInput.clientWidth || 240) - 8);
    const leftPx = Math.max(0, Math.min(cmdMeasure.offsetWidth - (cmdInput.scrollLeft || 0), maxOffset));
    cmdCursor.style.left = `${leftPx}px`;
  }

  function appendLine(text, className) {
    if (!cmdOutput) return;
    const p = document.createElement("p");
    p.className = className ? `cmd-line ${className}` : "cmd-line";
    p.textContent = text;
    cmdOutput.appendChild(p);
  }

  function runCommand(raw) {
    if (!cmdOutput) return;
    const typed = String(raw || "").trim().toLowerCase();
    if (!typed) return;
    const cmd = typed.replace(/^\/+/, "");

    if (cmd === "clear" || cmd === "cls") {
      cmdOutput.innerHTML = "";
      setMascotMood("idle");
      return;
    }

    appendLine(`> ${typed}`, "cmd-line--echo");

    const handler = COMMANDS[cmd];
    if (handler) {
      handler().forEach((line) => appendLine(line));
      setMascotMood("happy");
    } else {
      appendLine(`• команда не найдена: ${typed}. введите "help"`, "cmd-line--muted");
      setMascotMood("error");
    }

    while (cmdOutput.children.length > 28) {
      cmdOutput.removeChild(cmdOutput.firstChild);
    }
    cmdOutput.scrollTop = cmdOutput.scrollHeight;
  }

  if (cmdForm && cmdInput) {
    if (cmdCursor && cmdMeasure) {
      cmdForm.classList.add("has-block-cursor");
      ["input", "keyup", "click", "scroll", "focus"].forEach((evt) => {
        cmdInput.addEventListener(evt, syncCmdCursor);
      });
      syncCmdCursor();
    }

    cmdForm.addEventListener("submit", (e) => {
      e.preventDefault();
      runCommand(cmdInput.value);
      cmdInput.value = "";
      syncCmdCursor();
    });
  }

  cmdChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      runCommand(chip.dataset.cmd);
    });
  });
})();
