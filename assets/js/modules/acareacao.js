(function () {
  "use strict";

  const MONTHS = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function getRadioValue(name) {
    const checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function formatDeliveryDate(value) {
    if (!value) return "";
    return String(value).trim();
  }

  function getAutoDateParts() {
    const date = new Date();
    date.setDate(date.getDate() + 1);

    return {
      day: String(date.getDate()),
      month: MONTHS[date.getMonth()],
      year: String(date.getFullYear())
    };
  }

  function textValue(id) {
    const el = byId(id);
    return el ? el.value.trim() : "";
  }

  function setText(id, value, fallback) {
    const el = byId(id);
    if (el) {
      el.textContent = value || fallback || "";
    }
  }

  function setChecked(id, checked) {
    const el = byId(id);
    if (!el) return;
    el.classList.toggle("is-checked", Boolean(checked));
  }

  function setDefaultDates() {
    const delivery = byId("dataEntrega");
    if (delivery && !delivery.value) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      delivery.value = dd + "/" + mm + "/" + yyyy;
    }
  }

  function sanitizeFilePart(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toUpperCase();
  }

  function getLastFourDigits(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "0000";
    return digits.slice(-4).padStart(4, "0");
  }

  function updatePreview() {
    const autoDate = getAutoDateParts();
    const quemRecebeu = getRadioValue("quemRecebeu");
    const reconhecimento = getRadioValue("reconhecimento");
    const motivo = byId("motivoPrincipal")
      ? byId("motivoPrincipal").value
      : "contestando-remessa";

    setText("previewMotoristaNome", textValue("motoristaNome"), " ");
    setText("previewDataEntrega", formatDeliveryDate(textValue("dataEntrega")), " ");
    setText("previewEnderecoEntrega", textValue("enderecoEntrega"), " ");
    setText("previewTitularCompra", textValue("titularCompra"), " ");
    setText("previewSiteCompra", textValue("siteCompra"), " ");
    setText("previewNotaFiscal", textValue("notaFiscal"), " ");
    setText("previewIdPedido", textValue("idPedido"), " ");
    setText("previewTelefoneTitular", textValue("telefoneTitular"), "________________");
    setText("previewOutrosRecebedor", textValue("outrosRecebedor"), "____________________");
    setText("previewRecebedorNome", textValue("recebedorNome"), " ");
    setText("previewRecebedorDocumento", textValue("recebedorDocumento"), " ");
    setText("previewCidade", (textValue("cidade") || "Guarulhos").toUpperCase(), "GUARULHOS");
    setText("previewDia", autoDate.day, autoDate.day);
    setText("previewMes", autoDate.month, autoDate.month);
    setText("previewAno", autoDate.year, autoDate.year);

    setChecked("checkMotivoRemessa", motivo === "contestando-remessa");
    setChecked("checkMotivoLacre", motivo === "contestando-lacre");

    setChecked("checkDestinatario", quemRecebeu === "destinatario");
    setChecked("checkParente", quemRecebeu === "parente-funcionario");
    setChecked("checkOutros", quemRecebeu === "outros");

    setChecked("checkReconhecidoCorreto", reconhecimento === "endereco-correto");
    setChecked("checkReconhecidoErrado", reconhecimento === "endereco-errado");
    setChecked("checkReconhecidoNao", reconhecimento === "nao");
  }

  function fillExample() {
    byId("motoristaNome").value = "LUCIANO SOUZA";
    byId("enderecoEntrega").value = "Rua Iva Vilas Barros, 388 - Casa - Vila Barros - Guarulhos/SP";
    byId("titularCompra").value = "JOSE CARLOS OLIVEIRA";
    byId("siteCompra").value = "Tiktok";
    byId("notaFiscal").value = "998801";
    byId("idPedido").value = "7034213";
    byId("telefoneTitular").value = "11 99988-7766";
    byId("motivoPrincipal").value = "contestando-remessa";

    const quemRecebeu = document.querySelector('input[name="quemRecebeu"][value="destinatario"]');
    if (quemRecebeu) quemRecebeu.checked = true;

    byId("outrosRecebedor").value = "";
    byId("recebedorNome").value = "JOSE CARLOS OLIVEIRA";
    byId("recebedorDocumento").value = "CPF 123.456.789-00";

    const reconhecimento = document.querySelector('input[name="reconhecimento"][value="endereco-correto"]');
    if (reconhecimento) reconhecimento.checked = true;

    byId("cidade").value = "Guarulhos";
    updatePreview();
  }

  function clearForm() {
    document
      .querySelectorAll('.acareacao-form-card input[type="text"]')
      .forEach(function (input) {
        if (input.id === "cidade") {
          input.value = "Guarulhos";
        } else {
          input.value = "";
        }
      });

    if (byId("motivoPrincipal")) {
      byId("motivoPrincipal").value = "contestando-remessa";
    }

    const quemRecebeu = document.querySelector('input[name="quemRecebeu"][value="destinatario"]');
    if (quemRecebeu) quemRecebeu.checked = true;

    const reconhecimento = document.querySelector('input[name="reconhecimento"][value="endereco-correto"]');
    if (reconhecimento) reconhecimento.checked = true;

    setDefaultDates();
    updatePreview();
  }

  async function savePdf() {
    const sheet = byId("acareacaoPrintArea") || byId("acareacaoSheet");

    if (!sheet || !window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
      const box = byId("appMessage");
      if (box) {
        box.className = "message-box is-error";
        box.textContent = "Não foi possível gerar o PDF porque a biblioteca não carregou.";
      }
      return;
    }

    updatePreview();

    const canvas = await window.html2canvas(sheet, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight
    });

    const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 5;
    const usableWidth = pageWidth - (margin * 2);
    const usableHeight = pageHeight - (margin * 2);
    const imageData = canvas.toDataURL("image/png");
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(usableWidth / imgWidth, usableHeight / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;
    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = (pageHeight - renderHeight) / 2;

    pdf.addImage(imageData, "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");

    const motorista = sanitizeFilePart(textValue("motoristaNome")) || "MOTORISTA";
    const sufixo = getLastFourDigits(textValue("idPedido") || textValue("notaFiscal"));

    pdf.save("Acareacao_" + motorista + "_" + sufixo + ".pdf");

    const box = byId("appMessage");
    if (box) {
      box.className = "message-box is-success";
      box.textContent = "PDF gerado e baixado com sucesso.";
    }
  }

  function bindEvents() {
    document
      .querySelectorAll(".acareacao-form-card input, .acareacao-form-card select")
      .forEach(function (field) {
        field.addEventListener("input", updatePreview);
        field.addEventListener("change", updatePreview);
      });

    const exampleBtn = byId("fillExampleBtn");
    const clearBtn = byId("clearAcareacaoBtn");
    const saveBtn = byId("savePdfBtn");

    if (exampleBtn) {
      exampleBtn.addEventListener("click", fillExample);
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", clearForm);
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        savePdf().catch(function (error) {
          console.error(error);

          const box = byId("appMessage");
          if (box) {
            box.className = "message-box is-error";
            box.textContent = error.message || "Falha ao salvar PDF.";
          }
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setDefaultDates();
    bindEvents();
    updatePreview();
  });
})();