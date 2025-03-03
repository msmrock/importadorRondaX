// terceiros.js
let authToken = "";
let processedResults = null;
let currentOperation = ""; // "company" or "contract"

// Verificar se já há um token armazenado quando a página carrega
document.addEventListener("DOMContentLoaded", function () {
  // Recuperar token do localStorage (se existir)
  authToken = localStorage.getItem("authToken") || "";
  console.log(
    "Token recuperado do localStorage:",
    authToken ? "Token presente" : "Nenhum token"
  );

  if (!authToken) {
    // Redirecionar para página de login se não estiver autenticado
    alert(
      "Sessão não encontrada ou expirada. Por favor, faça login novamente."
    );
    window.location.href = "index.html";
  }
});

// Funções para controlar o loading
function showLoading() {
  document.getElementById("loadingOverlay").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden");
}

// Funções para navegação entre seções
function showCompanyUpload() {
  document.getElementById("mainMenu").classList.add("hidden");
  document.getElementById("contractUploadForm").classList.add("hidden");
  document.getElementById("results").classList.add("hidden");
  document.getElementById("companyUploadForm").classList.remove("hidden");
}

function showContractUpload() {
  document.getElementById("mainMenu").classList.add("hidden");
  document.getElementById("companyUploadForm").classList.add("hidden");
  document.getElementById("results").classList.add("hidden");
  document.getElementById("contractUploadForm").classList.remove("hidden");
}

function backToMainMenu() {
  document.getElementById("companyUploadForm").classList.add("hidden");
  document.getElementById("contractUploadForm").classList.add("hidden");
  document.getElementById("results").classList.add("hidden");
  document.getElementById("mainMenu").classList.remove("hidden");
}

async function handleCompanyUpload(event) {
  event.preventDefault();
  currentOperation = "company";

  const fileInput = document.getElementById("companyCsvFile");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Por favor, selecione um arquivo CSV.");
    return;
  }

  const file = fileInput.files[0];
  console.log(
    "Selected company file:",
    file.name,
    "size:",
    file.size,
    "type:",
    file.type
  );

  if (!authToken) {
    alert("Sessão expirada. Por favor, faça login novamente.");
    window.location.href = "index.html";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    showLoading();
    console.log(
      "Sending company request with auth token:",
      authToken.substring(0, 10) + "..."
    );

    const response = await fetch("http://localhost:3000/api/import-companies", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    console.log("Company response status:", response.status);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro no upload do arquivo");
    }

    processedResults = data;
    displayResults(processedResults, "Resultados da Importação de Empresas");
  } catch (error) {
    console.error("Company upload error:", error);
    if (
      error.message.includes("Unauthorized") ||
      error.message.includes("401")
    ) {
      alert("Sessão expirada. Por favor, faça login novamente.");
      window.location.href = "index.html";
    } else {
      alert(`Erro no processamento do arquivo: ${error.message}`);
    }
  } finally {
    hideLoading();
  }
}

async function handleContractUpload(event) {
  event.preventDefault();
  currentOperation = "contract";

  const fileInput = document.getElementById("contractCsvFile");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Por favor, selecione um arquivo CSV.");
    return;
  }

  const file = fileInput.files[0];
  console.log(
    "Selected contract file:",
    file.name,
    "size:",
    file.size,
    "type:",
    file.type
  );

  if (!authToken) {
    alert("Sessão expirada. Por favor, faça login novamente.");
    window.location.href = "index.html";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    showLoading();
    console.log(
      "Sending contract request with auth token:",
      authToken.substring(0, 10) + "..."
    );

    const response = await fetch("http://localhost:3000/api/import-contracts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    console.log("Contract response status:", response.status);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro no upload do arquivo");
    }

    processedResults = data;
    displayResults(processedResults, "Resultados da Importação de Contratos");
  } catch (error) {
    console.error("Contract upload error:", error);
    if (
      error.message.includes("Unauthorized") ||
      error.message.includes("401")
    ) {
      alert("Sessão expirada. Por favor, faça login novamente.");
      window.location.href = "index.html";
    } else {
      alert(`Erro no processamento do arquivo: ${error.message}`);
    }
  } finally {
    hideLoading();
  }
}

function displayResults(results, title) {
  console.log("Displaying results:", results);
  const resultsDiv = document.getElementById("resultsContent");
  resultsDiv.innerHTML = "";

  // Set the title
  document.getElementById("resultsTitle").textContent = title;

  // Success count
  const successCount = document.createElement("div");
  successCount.className = "text-green-600 p-2";
  successCount.textContent = `Registros processados com sucesso: ${results.success.length}`;
  resultsDiv.appendChild(successCount);

  // Success details
  if (results.success && results.success.length > 0) {
    const successDetails = document.createElement("div");
    successDetails.className = "mt-4 p-4 bg-green-50 rounded";
    successDetails.innerHTML =
      '<h3 class="font-bold">Registros processados com sucesso:</h3>';
    const successList = document.createElement("ul");
    successList.className = "mt-2 list-disc pl-5";

    results.success.forEach((item) => {
      const li = document.createElement("li");
      li.className = "text-green-600";

      if (currentOperation === "company") {
        li.textContent = `Nome Fantasia: ${item.tradeName}, CNPJ: ${item.document}, ID: ${item.id}`;
      } else if (currentOperation === "contract") {
        li.textContent = `Contrato: ${item.contractNumber}, ID da Empresa: ${item.companyId}, ID: ${item.id}`;
      }

      successList.appendChild(li);
    });

    successDetails.appendChild(successList);
    resultsDiv.appendChild(successDetails);
  }

  // Error count
  const errorCount = document.createElement("div");
  errorCount.className = "text-red-600 p-2 mt-4";
  errorCount.textContent = `Registros com erro: ${results.errors?.length || 0}`;
  resultsDiv.appendChild(errorCount);

  // Error details
  if (results.errors && results.errors.length > 0) {
    const errorDetails = document.createElement("div");
    errorDetails.className = "mt-4 p-4 bg-red-50 rounded";
    errorDetails.innerHTML = '<h3 class="font-bold">Detalhes dos erros:</h3>';
    const errorList = document.createElement("ul");
    errorList.className = "mt-2 list-disc pl-5";

    results.errors.forEach((item) => {
      const li = document.createElement("li");
      li.className = "text-red-600";

      if (currentOperation === "company") {
        li.textContent = `Nome Fantasia: ${item.tradeName}, Razão Social: ${item.companyName}, Erro: ${item.error}`;
      } else if (currentOperation === "contract") {
        li.textContent = `Contrato: ${item.contractNumber}, ID da Empresa: ${item.companyId}, Erro: ${item.error}`;
      }

      errorList.appendChild(li);
    });

    errorDetails.appendChild(errorList);
    resultsDiv.appendChild(errorDetails);
  }

  // Hide the forms and show results
  document.getElementById("companyUploadForm").classList.add("hidden");
  document.getElementById("contractUploadForm").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");
}

function downloadResults() {
  if (!processedResults) return;

  const title =
    currentOperation === "company" ? "EMPRESAS TERCEIRIZADAS" : "CONTRATOS";

  const content = [
    `RELATÓRIO DE PROCESSAMENTO - ${title}\n`,
    "========================\n",
    `Data: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`,
    `Total de registros: ${
      processedResults.success.length + processedResults.errors.length
    }\n`,
    `Sucessos: ${processedResults.success.length}\n`,
    `Erros: ${processedResults.errors.length}\n\n`,
    "REGISTROS PROCESSADOS COM SUCESSO:\n",
    "--------------------------------\n",
  ];

  // Adiciona registros de sucesso
  processedResults.success.forEach((item) => {
    if (currentOperation === "company") {
      content.push(
        `- Nome Fantasia: ${item.tradeName}\n  Razão Social: ${item.companyName}\n  Documento: ${item.document}\n  ID: ${item.id}\n\n`
      );
    } else if (currentOperation === "contract") {
      content.push(
        `- Contrato: ${item.contractNumber}\n  ID da Empresa: ${item.companyId}\n  ID: ${item.id}\n\n`
      );
    }
  });

  // Adiciona registros com erro
  if (processedResults.errors.length > 0) {
    content.push("\nREGISTROS COM ERRO:\n");
    content.push("--------------------------------\n");
    processedResults.errors.forEach((item) => {
      if (currentOperation === "company") {
        content.push(
          `- Nome Fantasia: ${item.tradeName}\n  Razão Social: ${
            item.companyName || "N/A"
          }\n  Documento: ${item.document || "N/A"}\n  Erro: ${item.error}\n\n`
        );
      } else if (currentOperation === "contract") {
        content.push(
          `- Contrato: ${item.contractNumber || "N/A"}\n  ID da Empresa: ${
            item.companyId || "N/A"
          }\n  Erro: ${item.error}\n\n`
        );
      }
    });
  }

  const blob = new Blob([content.join("")], {
    type: "text/plain;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_${currentOperation}_${
    new Date().toISOString().split("T")[0]
  }.txt`;
  a.click();
  window.URL.revokeObjectURL(url);
}

//Usuario logado

document.addEventListener("DOMContentLoaded", function () {
  // Seleciona o input pelo id
  const usernameInput = document.getElementById("username");

  // Seleciona o span no footer
  const footerSpan = document.querySelector(".footer span");

  if (usernameInput && footerSpan) {
    // Função para atualizar o span com o valor do input
    function updateFooterWithUsername() {
      // Obtém o valor atual do input
      const username = usernameInput.value;

      if (username) {
        // Salva o valor no localStorage para uso entre páginas
        localStorage.setItem("username", username);

        // Atualiza o conteúdo do span (mantendo")
        footerSpan.innerHTML = `<i>${username}</i>`;
      } else {
        // Tenta obter o valor do localStorage
        const savedUsername = localStorage.getItem("username");

        if (savedUsername) {
          // Preenche o input com o valor salvo
          usernameInput.value = savedUsername;

          // Atualiza o span
          footerSpan.innerHTML = `<i>${savedUsername}</i>`;
        } else {
          // Caso não tenha valor salvo, manter o texto original
          footerSpan.innerHTML = `&#128100`;
        }
      }
    }

    // Adiciona um evento para escutar mudanças no input
    usernameInput.addEventListener("input", function () {
      // Obtém o valor atual do input
      const username = usernameInput.value;

      // Salva o valor no localStorage
      localStorage.setItem("username", username);

      // Atualiza o footer
      updateFooterWithUsername();
    });

    // Chama a função quando a página carrega
    updateFooterWithUsername();
  } else if (footerSpan) {
    // Se estamos em uma página sem o input, mas com o footer
    const savedUsername = localStorage.getItem("username");

    if (savedUsername) {
      // Atualiza o span mesmo sem ter o input na página
      footerSpan.innerHTML = `<i>${savedUsername}</i>`;
    }
  }
});

//Usuario Logado
