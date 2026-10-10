(() => {
  const config = window.SITE_CONFIG || {};
  const cleanNumber = String(config.whatsappNumber || "").replace(/\\D/g, "");
  const status = document.querySelector("[data-contact-status]");
  const filters = document.querySelectorAll("[data-filter]");
  const cards = document.querySelectorAll(".catalog-card");

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.filter;
      filters.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      cards.forEach((card) => {
        card.hidden = selected !== "semua" && card.dataset.category !== selected;
      });
    });
  });

  document.querySelectorAll(".order-button").forEach((button) => {
    button.addEventListener("click", () => {
      const product = button.dataset.product || "Website RuangWeb";
      const packageName = button.dataset.package || "Belum ditentukan";
      const message = [
        "Halo RuangWeb, saya tertarik memesan website.",
        "",
        "Desain/produk: " + product,
        "Paket: " + packageName,
        "Nama usaha/sekolah: ",
        "Kustomisasi yang diinginkan: ",
        "",
        "Mohon informasi biaya akhir dan waktu pengerjaan. Terima kasih."
      ].join("\\n");

      if (cleanNumber.length >= 10) {
        window.location.href = "https://wa.me/" + cleanNumber + "?text=" + encodeURIComponent(message);
        return;
      }

      if (status) {
        status.textContent = "Kontak WhatsApp bisnis sedang disiapkan. Pilihan Anda: " + product + " (" + packageName + ").";
        document.querySelector("#kontak")?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.location.href = "../index.html#kontak";
      }
    });
  });
})();
