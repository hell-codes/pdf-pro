
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    initPageTransition();
    initNavbarScroll();
    initScrollReveal();
    initCardTilt();
    initRipple();
    initCounters();
    initMobileMenu();
    initFaqAccordion();
  });

  function initPageTransition() {
    const overlay = document.querySelector('.page-transition-overlay');
    if (!overlay) return;
    window.addEventListener('load', () => {
      setTimeout(() => overlay.classList.add('hidden'), 200);
    });
  }

  function initNavbarScroll() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    const onScroll = window.PDFProUtils.throttle(() => {
      nav.classList.toggle('scrolled', window.scrollY > 12);
    }, 50);
    window.addEventListener('scroll', onScroll);
    onScroll();
  }

  function initScrollReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in-view'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    const groups = {};
    items.forEach((el) => {
      const group = el.dataset.revealGroup;
      if (group) {
        groups[group] = groups[group] || 0;
        el.style.setProperty('--reveal-delay', `${groups[group] * 70}ms`);
        groups[group]++;
      }
      observer.observe(el);
    });
  }

  function initCardTilt() {
    const cards = document.querySelectorAll('[data-tilt]');
    cards.forEach((card) => {
      card.classList.add('tilt');
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--ry', `${x * 8}deg`);
        card.style.setProperty('--rx', `${-y * 8}deg`);
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  function initRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  }

  function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.count, 10) || 0;
            const suffix = el.dataset.countSuffix || '';
            window.PDFProUtils.animateCounter(el, target, 1400, suffix);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  function initMobileMenu() {
    const burger = document.querySelector('.nav-burger');
    const menu = document.querySelector('.mobile-menu');
    if (!burger || !menu) return;

    burger.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      burger.classList.toggle('active', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        burger.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  function initFaqAccordion() {
    const items = document.querySelectorAll('.faq-item');
    items.forEach((item) => {
      const question = item.querySelector('.faq-question');
      const answer = item.querySelector('.faq-answer');
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        items.forEach((other) => {
          other.classList.remove('open');
          other.querySelector('.faq-answer').style.maxHeight = null;
          other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
          question.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }
})();
