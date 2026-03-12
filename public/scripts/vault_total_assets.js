function updateVaultAssets() {

  const vault = window.bucketTotals?.vault || 0;
  const metals = window.bucketTotals?.metals || 0;

  const total = vault + metals;

  const el = document.getElementById("vault-assets");
  if (!el) return;

  el.textContent = `$${total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// run repeatedly in case other scripts load later
setInterval(updateVaultAssets, 500);