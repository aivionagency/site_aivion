const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");
const mobileLinks = mobileMenu ? mobileMenu.querySelectorAll("a") : [];
const sections = document.querySelectorAll(".section");
const heroPanels = document.querySelectorAll(".hero-panel");
const heroSection = document.getElementById("hero");
const openingScreen = document.getElementById("welcome");
const openingScreenBackground = openingScreen ? openingScreen.querySelector(".opening-screen__background") : null;
const openingScreenLottie = document.getElementById("openingScreenLottie");
const sectionCanvases = document.querySelectorAll(".section-dot-grid");
const casesSection = document.getElementById("cases");
const caseCards = document.querySelectorAll(".cases-section .case-card");
const servicesSection = document.getElementById("services");
const servicesCards = document.querySelectorAll(".services-section .service-card");
const processSection = document.getElementById("process");
const processSteps = document.querySelectorAll(".process-section .process-step");
const contactForm = document.getElementById("contactForm");
const customRoleField = document.getElementById("customRoleField");
const formStatus = document.getElementById("formStatus");
const submitButton = document.getElementById("submitButton");
const contactModal = document.getElementById("contactModal");
const formOpeners = document.querySelectorAll("[data-open-form]");
const formClosers = document.querySelectorAll("[data-close-form]");

const pointerState = {
  x: -9999,
  y: -9999,
  active: false
};

let activeSection = null;
let cursorInteractive = false;
let heroTicking = false;
let sceneTicking = false;
let openingLottieInstance = null;
let openingLottieFrame = 0;
let openingLottieRaf = 0;
let openingPointerLastX = null;
let openingPointerLastY = null;
let openingPointerIdleTimer = 0;
let openingLottieVelocity = 0.12;
let openingLottieTargetVelocity = 0.12;
let lastScrollY = window.scrollY;

function toggleMenu(forceOpen) {
  if (!menuToggle || !mobileMenu) {
    return;
  }

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !mobileMenu.classList.contains("is-open");
  mobileMenu.classList.toggle("is-open", shouldOpen);
  menuToggle.classList.toggle("is-open", shouldOpen);
  menuToggle.setAttribute("aria-expanded", String(shouldOpen));
  document.body.classList.toggle("menu-open", shouldOpen);
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    toggleMenu();
  });
}

mobileLinks.forEach((link) => {
  link.addEventListener("click", () => toggleMenu(false));
});

sections.forEach((section) => {
  const staggerItems = section.querySelectorAll(".stagger-item");
  staggerItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 40, 160)}ms`;
  });
});

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");

        if (activeSection && activeSection !== entry.target) {
          activeSection.classList.remove("is-active");
        }

        entry.target.classList.add("is-active");
        activeSection = entry.target;
      } else if (entry.target === activeSection && entry.intersectionRatio < 0.2) {
        entry.target.classList.remove("is-active");
      }
    });
  },
  {
    threshold: [0.2, 0.45, 0.7]
  }
);

sections.forEach((section) => sectionObserver.observe(section));

document.addEventListener("mousemove", (event) => {
  pointerState.x = event.clientX;
  pointerState.y = event.clientY;
  pointerState.active = true;
  updateOpeningScreenPointer(event.clientX, event.clientY);
});

document.addEventListener("mouseleave", () => {
  pointerState.active = false;
  resetOpeningScreenPointer();
});

const heroObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("current", entry.isIntersecting);
    });
  },
  {
    threshold: 0.01
  }
);

heroPanels.forEach((panel) => heroObserver.observe(panel));

function updateHeroPanels() {
  if (!heroSection || !heroPanels.length) {
    return;
  }

  const rect = heroSection.getBoundingClientRect();
  const viewportHeight = Math.max(window.innerHeight, 1);
  const scrollable = Math.max(rect.height - viewportHeight, 1);
  const rawProgress = Math.min(Math.max(-rect.top / scrollable, 0), 1);
  const scaledProgress = rawProgress * (heroPanels.length - 1);
  const introProgress = easeInOutCubic(clamp((viewportHeight - rect.top) / (viewportHeight * 0.72), 0, 1));

  heroPanels.forEach((panel, index) => {
    const delta = scaledProgress - index;
    const exitProgress = delta > 0 ? Math.min(delta / 0.52, 1) : 0;
    const enterProgress = delta < 0 ? Math.min(Math.max((delta + 0.72) / 0.28, 0), 1) : 1;
    let visibility = delta >= 0 ? 1 - exitProgress : enterProgress;
    let opacity = Math.max(0, Math.min(1, visibility));
    let translateY = delta >= 0 ? -22 * exitProgress : 16 - 16 * enterProgress;
    const scale = delta >= 0 ? 1 - exitProgress * 0.03 : 0.982 + enterProgress * 0.018;
    let blur = delta >= 0 ? exitProgress * 10 : (1 - enterProgress) * 10;

    if (index === 0 && rect.top > 0) {
      opacity *= introProgress;
      translateY += (1 - introProgress) * 14;
      blur += (1 - introProgress) * 8;
    }

    panel.style.opacity = opacity.toFixed(3);
    panel.style.transform = `translate3d(0, ${translateY.toFixed(2)}vh, 0) scale(${scale.toFixed(4)})`;
    panel.style.filter = `blur(${blur.toFixed(2)}px)`;
    panel.style.zIndex = String(delta >= 0 ? heroPanels.length + 1 : heroPanels.length - index);
    panel.classList.toggle("current", opacity > 0.5);
  });
}

function requestHeroUpdate() {
  if (heroTicking) {
    return;
  }

  heroTicking = true;
  window.requestAnimationFrame(() => {
    heroTicking = false;
    updateHeroPanels();
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function easeInOutCubic(value) {
  if (value < 0.5) {
    return 4 * value * value * value;
  }

  return 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function updateOpeningScreenPointer(clientX, clientY) {
  if (!openingScreen || !openingScreenBackground) {
    return;
  }

  const rect = openingScreen.getBoundingClientRect();
  const inside =
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom;

  if (!inside) {
    resetOpeningScreenPointer();
    return;
  }

  const relativeX = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const relativeY = clamp((clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
  const shiftX = (relativeX - 0.5) * 22;
  const shiftY = (relativeY - 0.5) * 16;
  const movementX = openingPointerLastX === null ? 0 : clientX - openingPointerLastX;
  const movementY = openingPointerLastY === null ? 0 : clientY - openingPointerLastY;
  const movement = Math.hypot(movementX, movementY);

  openingScreen.style.setProperty("--opening-cursor-x", `${(relativeX * 100).toFixed(2)}%`);
  openingScreen.style.setProperty("--opening-cursor-y", `${(relativeY * 100).toFixed(2)}%`);
  openingScreen.style.setProperty("--opening-shift-x", `${shiftX.toFixed(2)}px`);
  openingScreen.style.setProperty("--opening-shift-y", `${shiftY.toFixed(2)}px`);

  openingPointerLastX = clientX;
  openingPointerLastY = clientY;

  if (openingLottieInstance && movement > 0.2) {
    boostOpeningLottie(movement);
  }

  if (openingPointerIdleTimer) {
    window.clearTimeout(openingPointerIdleTimer);
  }

  openingPointerIdleTimer = window.setTimeout(() => {
    openingLottieTargetVelocity = 0.12;
  }, 220);
}

function resetOpeningScreenPointer() {
  if (!openingScreen) {
    return;
  }

  if (openingPointerIdleTimer) {
    window.clearTimeout(openingPointerIdleTimer);
    openingPointerIdleTimer = 0;
  }

  openingScreen.style.setProperty("--opening-shift-x", "0px");
  openingScreen.style.setProperty("--opening-shift-y", "0px");
  openingPointerLastX = null;
  openingPointerLastY = null;
  openingLottieTargetVelocity = 0.12;
}

function stepOpeningLottieMotion() {
  openingLottieRaf = 0;

  if (!openingLottieInstance) {
    return;
  }

  const totalFrames = Math.max(Math.round(openingLottieInstance.getDuration(true)) - 1, 1);
  openingLottieVelocity += (openingLottieTargetVelocity - openingLottieVelocity) * 0.08;
  openingLottieFrame = (openingLottieFrame + openingLottieVelocity + totalFrames) % totalFrames;
  openingLottieInstance.goToAndStop(openingLottieFrame, true);
  openingLottieRaf = window.requestAnimationFrame(stepOpeningLottieMotion);
}

function startOpeningLottieMotion() {
  if (openingLottieRaf || !openingLottieInstance) {
    return;
  }

  openingLottieRaf = window.requestAnimationFrame(stepOpeningLottieMotion);
}

function isOpeningScreenInView() {
  if (!openingScreen) {
    return false;
  }

  const rect = openingScreen.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function boostOpeningLottie(amount) {
  if (!openingLottieInstance) {
    return;
  }

  const boostVelocity = clamp(0.12 + amount * 0.012, 0.12, 0.42);
  openingLottieTargetVelocity = Math.max(openingLottieTargetVelocity, boostVelocity);
  startOpeningLottieMotion();
}

function syncOpeningScreenScroll() {
  const currentScrollY = window.scrollY;
  const delta = Math.abs(currentScrollY - lastScrollY);
  lastScrollY = currentScrollY;

  if (!delta || !isOpeningScreenInView()) {
    return;
  }

  boostOpeningLottie(delta);

  if (openingPointerIdleTimer) {
    window.clearTimeout(openingPointerIdleTimer);
  }

  openingPointerIdleTimer = window.setTimeout(() => {
    openingLottieTargetVelocity = 0.12;
  }, 220);
}

function initOpeningScreenLottie() {
  if (!openingScreenLottie || !window.lottie) {
    return;
  }

  openingLottieInstance = window.lottie.loadAnimation({
    container: openingScreenLottie,
    renderer: "svg",
    loop: true,
    autoplay: false,
    path: "./assets/hero-section.json",
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
      progressiveLoad: true
    }
  });

  openingLottieInstance.addEventListener("DOMLoaded", () => {
    openingLottieFrame = 0;
    openingLottieVelocity = 0.12;
    openingLottieTargetVelocity = 0.12;
    openingLottieInstance.goToAndStop(0, true);
    startOpeningLottieMotion();
  });
}

function updateScrollScenes() {
  if (casesSection) {
    const rect = casesSection.getBoundingClientRect();
    const viewportHeight = Math.max(window.innerHeight, 1);
    const sectionProgress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height * 0.22), 0, 1);

    caseCards.forEach((card, index) => {
      const localProgress = clamp((sectionProgress - index * 0.08) / 0.42, 0, 1);
      const eased = easeInOutCubic(localProgress);
      const offsetY = (1 - eased) * 74;
      const scale = 0.93 + eased * 0.07;
      const opacity = 0.16 + eased * 0.84;
      const rotateX = (1 - eased) * 8;

      card.style.opacity = opacity.toFixed(3);
      card.style.transform = `perspective(1200px) translate3d(0, ${offsetY.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotateX(${rotateX.toFixed(2)}deg)`;
    });
  }

  if (servicesSection) {
    const rect = servicesSection.getBoundingClientRect();
    const viewportHeight = Math.max(window.innerHeight, 1);
    const sectionProgress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height * 0.28), 0, 1);

    servicesCards.forEach((card, index) => {
      const localProgress = clamp((sectionProgress - index * 0.12) / 0.56, 0, 1);
      const eased = easeInOutCubic(localProgress);
      const offsetX = (index % 2 === 0 ? -1 : 1) * (1 - eased) * 54;
      const offsetY = (1 - eased) * 54;
      const scale = 0.94 + eased * 0.06;
      const opacity = 0.18 + eased * 0.82;
      const rotate = (index % 2 === 0 ? -1 : 1) * (1 - eased) * 2.2;
      const blur = (1 - eased) * 6;

      card.style.opacity = opacity.toFixed(3);
      card.style.transform = `perspective(1400px) translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`;
      card.style.filter = `blur(${blur.toFixed(2)}px)`;
    });
  }

  if (processSection) {
    const rect = processSection.getBoundingClientRect();
    const viewportHeight = Math.max(window.innerHeight, 1);
    const baseProgress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height * 0.16), 0, 1);

    processSteps.forEach((step, index) => {
      const localProgress = clamp((baseProgress - index * 0.085) / 0.42, 0, 1);
      const eased = easeInOutCubic(localProgress);
      const travelX = (1 - eased) * 240;
      const travelY = (1 - eased) * 24;
      const opacity = 0.08 + eased * 0.92;
      const scale = 0.92 + eased * 0.08;
      const blur = (1 - eased) * 14;

      step.style.opacity = opacity.toFixed(3);
      step.style.transform = `translate3d(${travelX.toFixed(2)}px, ${travelY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      step.style.filter = `blur(${blur.toFixed(2)}px)`;
    });
  }
}

function requestSceneUpdate() {
  if (sceneTicking) {
    return;
  }

  sceneTicking = true;
  window.requestAnimationFrame(() => {
    sceneTicking = false;
    updateScrollScenes();
  });
}

if (heroSection) {
  const heroVisibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        document.body.classList.toggle("hero-active", entry.isIntersecting);
        cursorInteractive = !entry.isIntersecting;
      });
    },
    {
      threshold: 0.4
    }
  );

  heroVisibilityObserver.observe(heroSection);
  window.addEventListener("scroll", requestHeroUpdate, { passive: true });
  window.addEventListener("resize", requestHeroUpdate);
  requestHeroUpdate();
}

window.addEventListener(
  "scroll",
  () => {
    requestSceneUpdate();
    syncOpeningScreenScroll();
  },
  { passive: true }
);
window.addEventListener("resize", requestSceneUpdate);
requestSceneUpdate();
initOpeningScreenLottie();
resetOpeningScreenPointer();

function toggleForm(forceOpen) {
  if (!contactModal) {
    return;
  }

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !contactModal.classList.contains("is-open");
  contactModal.classList.toggle("is-open", shouldOpen);
  contactModal.setAttribute("aria-hidden", String(!shouldOpen));
  document.body.classList.toggle("menu-open", shouldOpen);

  if (shouldOpen) {
    const firstInput = contactModal.querySelector("input, textarea");
    if (firstInput instanceof HTMLElement) {
      window.setTimeout(() => firstInput.focus(), 40);
    }
  }
}

function setStatus(message, type) {
  if (!formStatus) {
    return;
  }

  formStatus.textContent = message;
  formStatus.classList.remove("is-success", "is-error");

  if (type === "success") {
    formStatus.classList.add("is-success");
  }

  if (type === "error") {
    formStatus.classList.add("is-error");
  }
}

function syncRoleField() {
  if (!contactForm || !customRoleField) {
    return;
  }

  const selectedRole = contactForm.querySelector('input[name="role"]:checked');
  const customInput = customRoleField.querySelector("input");
  const isCustom = selectedRole && selectedRole.value === "Другое";

  customRoleField.classList.toggle("is-visible", Boolean(isCustom));
  customInput.required = Boolean(isCustom);

  if (!isCustom) {
    customInput.value = "";
    customInput.setCustomValidity("");
  }
}

formOpeners.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    toggleMenu(false);
    toggleForm(true);
  });
});

formClosers.forEach((button) => {
  button.addEventListener("click", () => toggleForm(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && contactModal && contactModal.classList.contains("is-open")) {
    toggleForm(false);
  }
});

if (contactForm) {
  contactForm.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === "role") {
      syncRoleField();
    }
  });

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncRoleField();

    const formData = new FormData(contactForm);
    const payload = {
      firstName: String(formData.get("firstName") || "").trim(),
      company: String(formData.get("company") || "").trim(),
      contactMethod: String(formData.get("contactMethod") || "").trim(),
      role: String(formData.get("role") || "").trim(),
      customRole: String(formData.get("customRole") || "").trim(),
      details: String(formData.get("details") || "").trim(),
      contact: String(formData.get("contact") || "").trim(),
      policyAccepted: formData.get("policyAccepted") === "yes",
      consentAccepted: formData.get("consentAccepted") === "yes",
      website: String(formData.get("website") || "").trim()
    };

    const customInput = customRoleField ? customRoleField.querySelector("input") : null;

    if (!contactForm.reportValidity()) {
      setStatus("Проверьте обязательные поля.", "error");
      return;
    }

    if (payload.role === "Другое" && !payload.customRole && customInput) {
      customInput.setCustomValidity("Укажите роль.");
      customInput.reportValidity();
      setStatus("Укажите вашу роль.", "error");
      return;
    }

    if (customInput) {
      customInput.setCustomValidity("");
    }

    if (!payload.policyAccepted || !payload.consentAccepted) {
      setStatus("Нужно подтвердить согласие и ознакомление с политикой.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Отправляем...";
    setStatus("Отправляем запрос...", "");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Ошибка отправки.");
      }

      contactForm.reset();
      syncRoleField();
      setStatus("Запрос отправлен. Скоро свяжемся с вами.", "success");
      window.setTimeout(() => toggleForm(false), 900);
    } catch (error) {
      setStatus(error.message || "Не удалось отправить запрос. Попробуйте снова.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Отправить запрос";
    }
  });

  syncRoleField();
}

function createDotGridAnimation(canvas) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    return;
  }

  const state = {
    width: 0,
    height: 0,
    points: [],
    fields: []
  };

  function buildGrid() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const parent = canvas.parentElement;
    const bounds = parent ? parent.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const width = Math.max(320, Math.round(bounds.width));
    const height = Math.max(320, Math.round(bounds.height));
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    state.width = width;
    state.height = height;
    state.points = [];

    const margin = Math.max(28, Math.min(width, height) * 0.08);
    const pointCount = Math.max(180, Math.round((width * height) / 2400));

    for (let index = 0; index < pointCount; index += 1) {
      state.points.push({
        x: margin + Math.random() * (width - margin * 2),
        y: margin + Math.random() * (height - margin * 2),
        seed: Math.random() * Math.PI * 2,
        offset: Math.random() * 1000,
        weight: 0.7 + Math.random() * 0.6
      });
    }

    state.fields = Array.from({ length: width < 820 ? 4 : 6 }, () => ({
      x: margin + Math.random() * (width - margin * 2),
      y: margin + Math.random() * (height - margin * 2),
      vx: (Math.random() - 0.5) * 0.16,
      vy: (Math.random() - 0.5) * 0.12,
      radius: Math.max(170, Math.min(width, height) * (0.14 + Math.random() * 0.08)),
      stretchX: 0.78 + Math.random() * 0.7,
      stretchY: 0.78 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2
    }));
  }

  function animate(time) {
    context.clearRect(0, 0, state.width, state.height);

    state.fields.forEach((field) => {
      field.x += field.vx;
      field.y += field.vy;

      if (field.x < 70 || field.x > state.width - 70) {
        field.vx *= -1;
      }

      if (field.y < 70 || field.y > state.height - 70) {
        field.vy *= -1;
      }
    });

    const timeFactor = time * 0.001;
    const rect = canvas.getBoundingClientRect();
    const localPointerX = pointerState.x - rect.left;
    const localPointerY = pointerState.y - rect.top;
    const hasPointer =
      cursorInteractive &&
      pointerState.active &&
      localPointerX >= 0 &&
      localPointerX <= rect.width &&
      localPointerY >= 0 &&
      localPointerY <= rect.height;

    state.points.forEach((point) => {
      let fieldGlow = 0;

      state.fields.forEach((field) => {
        const dx = point.x - field.x;
        const dy = point.y - field.y;
        const angle = Math.atan2(dy, dx);
        const irregularity =
          1 +
          Math.sin(angle * 3 + timeFactor * 0.22 + field.phase) * 0.22 +
          Math.cos(angle * 5 - timeFactor * 0.16 + field.phase * 1.3) * 0.12;
        const distance = Math.hypot(dx / field.stretchX, dy / field.stretchY);
        const local = Math.max(0, 1 - distance / (field.radius * irregularity));
        fieldGlow = Math.max(fieldGlow, local);
      });

      const edgeX = Math.min(point.x, state.width - point.x);
      const edgeY = Math.min(point.y, state.height - point.y);
      const edgeFade = Math.max(0, Math.min(edgeX, edgeY) / 220);
      const centerDistance = Math.hypot(point.x - state.width * 0.5, point.y - state.height * 0.5);
      const maxCenterDistance = Math.hypot(state.width * 0.5, state.height * 0.5);
      const centerFade = Math.max(0, (centerDistance / maxCenterDistance - 0.24) / 0.76);
      const perimeterGlow = Math.pow(Math.min(1, edgeFade), 1.2) * Math.pow(centerFade, 1.75);
      const independentWave =
        (Math.sin(timeFactor * (1.1 + (point.seed % 1.1)) + point.seed * 5.4) + 1) * 0.5;
      const secondaryWave =
        (Math.sin(timeFactor * (1.85 + ((point.seed * 1.4) % 1.2)) + point.seed * 9.6) + 1) * 0.5;
      const ambientWave = independentWave * 0.42 + secondaryWave * 0.24;
      let cursorReveal = 0;
      let cursorWave = 0;

      if (hasPointer) {
        const pointerDistance = Math.hypot(point.x - localPointerX, point.y - localPointerY);
        cursorReveal = Math.max(0, 1 - pointerDistance / 220);
        const pulseRadius = 36 + ((Math.sin(timeFactor * 3.4 - point.offset * 0.012) + 1) * 0.5) * 150;
        cursorWave = Math.max(0, 1 - Math.abs(pointerDistance - pulseRadius) / 72) * cursorReveal;
      }

      const alpha = Math.min(
        0.74,
        perimeterGlow * (0.14 + fieldGlow * 0.22 + ambientWave * 0.34) + cursorReveal * 0.58 + cursorWave * 0.32
      );

      if (alpha < 0.03) {
        return;
      }

      const radius = Math.min(
        2.5,
        0.72 + perimeterGlow * 0.8 + fieldGlow * 0.34 + ambientWave * 0.22 + cursorReveal * 0.5 + cursorWave * 0.18
      );

      context.beginPath();
      context.fillStyle = `rgba(204, 255, 0, ${alpha.toFixed(3)})`;
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    });

    requestAnimationFrame(animate);
  }

  buildGrid();
  requestAnimationFrame(animate);
  window.addEventListener("resize", buildGrid);
}

sectionCanvases.forEach((canvas) => createDotGridAnimation(canvas));
