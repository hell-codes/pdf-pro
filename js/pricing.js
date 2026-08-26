(function () {
  function markCurrentPlan(isLoggedIn) {
    const freeCard = document.querySelector('[data-plan="free"]');
    const currentLabel = document.querySelector('[data-plan-current="free"]');
    const freeCta = document.querySelector('[data-plan-cta="free"]');
    if (!freeCard) return;

    freeCard.classList.toggle('is-current', isLoggedIn);
    if (currentLabel) currentLabel.hidden = !isLoggedIn;

    if (freeCta) {
      if (isLoggedIn) {
        freeCta.textContent = 'Go to your tools';
      } else if (freeCta.dataset.defaultLabel) {
        freeCta.textContent = freeCta.dataset.defaultLabel;
      }
    }
  }

  function initProCta() {
    const proCta = document.querySelector('[data-plan-cta="pro"]');
    if (!proCta) return;
    proCta.addEventListener('click', () => {
      if (window.PDFProToast) {
        window.PDFProToast.info('Pro is coming soon. No payment is taken yet — you can keep using every tool for free.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const freeCta = document.querySelector('[data-plan-cta="free"]');
    if (freeCta) freeCta.dataset.defaultLabel = freeCta.textContent;

    initProCta();

    if (window.PDFProAuth && window.PDFProAuth.isConfigured()) {
      window.PDFProAuth.onChange((user) => markCurrentPlan(Boolean(user)));
    }
  });
})();
