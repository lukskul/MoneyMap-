let vaultAssetsAnimationFrame;
let currentVaultAssetsDisplay = 0;
let lastVaultAssetsTotal = null;

function animateVaultAssets(targetValue) {
  const el = document.getElementById("vault-assets");
  if (!el) return;

  if (vaultAssetsAnimationFrame) {
    cancelAnimationFrame(vaultAssetsAnimationFrame);
  }

  const startValue = currentVaultAssetsDisplay;
  const duration = 900;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(time) {
    const progress = Math.min((time - startTime) / duration, 1);
    const eased = easeOutCubic(progress);

    const value = startValue + (targetValue - startValue) * eased;

    el.textContent = `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    if (progress < 1) {
      vaultAssetsAnimationFrame = requestAnimationFrame(frame);
    } else {
      currentVaultAssetsDisplay = targetValue;
    }
  }

  vaultAssetsAnimationFrame = requestAnimationFrame(frame);
}

function updateVaultAssets() {
  const vault = window.bucketTotals?.vault || 0;
  const metals = window.bucketTotals?.metals || 0;
  const total = vault + metals;

  // Only animate if the value changed
  if (total !== lastVaultAssetsTotal) {
    lastVaultAssetsTotal = total;
    animateVaultAssets(total);
  }
}

setInterval(updateVaultAssets, 500);