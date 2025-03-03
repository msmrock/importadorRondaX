let authToken = "";
let processedResults = null;

// Verificar se já existe um token armazenado ao carregar a página
document.addEventListener("DOMContentLoaded", function () {
  // Recuperar token do localStorage (se existir)
  const storedToken = localStorage.getItem("authToken");
  if (storedToken) {
    authToken = storedToken;
    console.log("Token recuperado do localStorage");

    // Mostrar o formulário de upload se já estiver logado
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("uploadForm").classList.remove("hidden");
  }
});

// Funções para controlar o loading
function showLoading() {
  document.getElementById("loadingOverlay").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden");
}

//FUNÇÃO LOGIN
async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    showLoading();
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    // Verifica se a resposta não está ok
    if (!response.ok) {
      // Tenta obter os detalhes do erro da resposta
      const errorData = await response.json();
      if (errorData.details) {
        throw new Error(errorData.details);
      } else if (errorData.error) {
        throw new Error(errorData.error);
      } else {
        throw new Error("Login falhou");
      }
    }

    const data = await response.json();
    console.log("Login response:", data);
    const tokenData = JSON.parse(data.jsonToken);
    authToken = tokenData.access_token;
    console.log("Token obtained successfully");

    // Armazene o token no localStorage
    localStorage.setItem("authToken", authToken);
    console.log("Token armazenado no localStorage");

    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("uploadForm").classList.remove("hidden");
  } catch (error) {
    console.error("Login error:", error);
    alert(error.message);
  } finally {
    hideLoading();
  }
}
//FUNÇÃO LOGIN

async function handleUpload(event) {
  event.preventDefault();
  console.log("Upload started");

  const fileInput = document.getElementById("csvFile");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Por favor, selecione um arquivo CSV.");
    return;
  }

  const file = fileInput.files[0];
  console.log(
    "Selected file:",
    file.name,
    "size:",
    file.size,
    "type:",
    file.type
  );

  if (!authToken) {
    alert("Sessão expirada. Por favor, faça login novamente.");
    handleLogout();
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    showLoading();
    console.log(
      "Sending request with auth token:",
      authToken.substring(0, 10) + "..."
    );
    const response = await fetch("http://localhost:3000/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", [...response.headers.entries()]);

    const data = await response.json();
    console.log("Response data:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(data.error || "Erro no upload do arquivo");
    }

    processedResults = data;
    displayResults(processedResults);
  } catch (error) {
    console.error("Upload error:", error);
    if (
      error.message.includes("Unauthorized") ||
      error.message.includes("401")
    ) {
      alert("Sessão expirada. Por favor, faça login novamente.");
      handleLogout();
    } else {
      alert(`Erro no processamento do arquivo: ${error.message}`);
    }
  } finally {
    hideLoading();
  }
}

function displayResults(results) {
  console.log("Displaying results:", results);
  const resultsDiv = document.getElementById("resultsContent");
  resultsDiv.innerHTML = "";

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
      li.textContent = `Nome: ${item.name}, CPF: ${item.cpf}, Cartão: ${item.cardNumber}`;
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
      li.textContent = `Nome: ${item.name}, CPF: ${item.cpf}, Erro: ${item.error}`;
      errorList.appendChild(li);
    });
    errorDetails.appendChild(errorList);
    resultsDiv.appendChild(errorDetails);
  }

  document.getElementById("uploadForm").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");
}

function downloadResults() {
  if (!processedResults) return;

  const content = [
    "RELATÓRIO DE PROCESSAMENTO\n",
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
    content.push(
      `- Nome: ${item.name}\n  CPF: ${item.cpf}\n  Cartão: ${item.cardNumber}\n  ID da Pessoa: ${item.personId}\n`
    );

    if (item.organizationalStructures) {
      item.organizationalStructures.forEach((struct) => {
        content.push(`  Estrutura ${struct.structureId}: ${struct.status}\n`);
      });
    }
    content.push("\n");
  });

  // Adiciona registros com erro
  if (processedResults.errors.length > 0) {
    content.push("\nREGISTROS COM ERRO:\n");
    content.push("--------------------------------\n");
    processedResults.errors.forEach((item) => {
      content.push(
        `- Nome: ${item.name}\n  CPF: ${item.cpf}\n  Erro: ${item.error}\n\n`
      );
    });
  }

  const blob = new Blob([content.join("")], {
    type: "text/plain;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_processamento_${
    new Date().toISOString().split("T")[0]
  }.txt`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function resetUpload() {
  document.getElementById("results").classList.add("hidden");
  document.getElementById("uploadForm").classList.remove("hidden");
  document.getElementById("csvFile").value = "";
  processedResults = null;
}

function handleLogout() {
  authToken = "";
  processedResults = null;
  // Limpar token do localStorage
  localStorage.removeItem("authToken");
  console.log("Token removido do localStorage");

  document.getElementById("uploadForm").classList.add("hidden");
  document.getElementById("results").classList.add("hidden");
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
}

function navigateToTerceiros() {
  // Verificar se o usuário está logado
  if (!authToken) {
    alert("Por favor, faça login primeiro.");
    return;
  }

  console.log(
    "Navegando para gestão de terceiros com token:",
    authToken ? "Token presente" : "Nenhum token"
  );
  // Navegar para a página de terceiros
  window.location.href = "terceiros.html";
}

//Proprietaria

async function getLicenseInfo() {
  if (!authToken) {
    alert("Sessão expirada. Por favor, faça login novamente.");
    handleLogout();
    return;
  }

  try {
    showLoading();
    console.log(
      "Obtendo informações de licença com token:",
      authToken.substring(0, 10) + "..."
    );

    const response = await fetch("http://localhost:3000/api/license-info", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Erro ao obter informações de licença: ${response.status}`
      );
    }

    const data = await response.json();
    console.log("Informações de licença:", data);

    // Exibir as informações em um modal ou div específico
    displayLicenseInfo(data.licenseInfo);
  } catch (error) {
    console.error("Erro ao obter informações de licença:", error);
    alert(`Erro ao obter informações de licença: ${error.message}`);
  } finally {
    hideLoading();
  }
}

// Função para exibir as informações de licença
function displayLicenseInfo(licenseInfo) {
  // Criar o conteúdo HTML para exibir as informações
  const content = `
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl max-h-3/4 overflow-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Proprietárias cadastradas</h2>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 font-bold text-lg bg-gray-100 p-2">Limites de Licença</div>
          
          <div class="font-medium">Leitores de Controle de Acesso:</div>
          <div>${licenseInfo.licenseReadersFromAccessDeviceLimit}</div>
          
          <div class="font-medium">Leitores de REP:</div>
          <div>${licenseInfo.licenseReadersFromREPLimit}</div>
          
          <div class="font-medium">Credenciais:</div>
          <div>${licenseInfo.licenseCredentialsLimit}</div>
          
          <div class="font-medium">Terceiros:</div>
          <div>${licenseInfo.licenseThirdLimit}</div>
          
          <div class="col-span-2 font-bold text-lg bg-gray-100 p-2 mt-2">Em Uso</div>
          
          <div class="font-medium">Dispositivos de Acesso:</div>
          <div>${licenseInfo.accessDeviceInUse} / ${licenseInfo.licenseReadersFromAccessDeviceLimit}</div>
          
          <div class="font-medium">Dispositivos REP:</div>
          <div>${licenseInfo.repDeviceInUse} / ${licenseInfo.licenseReadersFromREPLimit}</div>
          
          <div class="font-medium">Credenciais:</div>
          <div>${licenseInfo.credentialsInUse} / ${licenseInfo.licenseCredentialsLimit}</div>
          
          <div class="font-medium">Terceiros:</div>
          <div>${licenseInfo.thirdInUse} / ${licenseInfo.licenseThirdLimit}</div>
        </div>
        
        <button onclick="this.parentElement.parentElement.remove()" class="mt-6 w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition">
          Fechar
        </button>
      </div>
    </div>
  `;

  // Criar um elemento div para o modal e adicionar ao corpo do documento
  const modalContainer = document.createElement("div");
  modalContainer.innerHTML = content;
  document.body.appendChild(modalContainer.firstElementChild);
}

//Proprietaria

//RESET NIVEL

// Adicione esta função ao arquivo main.js

function resetPersonLevel() {
  if (!authToken) {
    alert("Sessão expirada. Por favor, faça login novamente.");
    handleLogout();
    return;
  }

  // Criar o modal para inserção dos IDs
  const modalContent = `
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Resetar Nível e Antipassback</h2>
        
        <div class="space-y-4">
          <div>
            <label for="startId" class="block text-sm font-medium text-gray-700">ID Inicial:</label>
            <input type="number" id="startId" min="1" class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
          </div>
          
          <div>
            <label for="endId" class="block text-sm font-medium text-gray-700">ID Final:</label>
            <input type="number" id="endId" min="1" class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
          </div>
        </div>
        
        <div class="mt-6 flex space-x-4">
          <button onclick="submitResetLevel()" class="flex-1 py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition">
            Confirmar
          </button>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" class="flex-1 py-2 px-4 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;

  // Criar um elemento div para o modal e adicionar ao corpo do documento
  const modalContainer = document.createElement("div");
  modalContainer.id = "resetLevelModal";
  modalContainer.innerHTML = modalContent;
  document.body.appendChild(modalContainer.firstElementChild);
}

// Função para enviar a solicitação de reset

// Versão atualizada da função para enviar a solicitação de reset
async function submitResetLevel() {
  const startId = document.getElementById("startId").value;
  const endId = document.getElementById("endId").value;

  if (!startId || !endId) {
    alert("Por favor, preencha os IDs inicial e final.");
    return;
  }

  if (parseInt(startId) > parseInt(endId)) {
    alert("O ID inicial deve ser menor ou igual ao ID final.");
    return;
  }

  try {
    // Remover o modal de entrada
    const modal = document.querySelector("#resetLevelModal");
    if (modal) {
      modal.parentElement.remove();
    }

    // Mostrar tela de carregamento com mensagem específica
    showCustomLoading(
      `Resetando níveis para ${
        parseInt(endId) - parseInt(startId) + 1
      } pessoas...`
    );

    console.log(
      `Resetando níveis para o intervalo de IDs ${startId} a ${endId}...`
    );

    const response = await fetch("http://localhost:3000/api/reset-level", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startId, endId }),
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();
    console.log("Resposta do reset de níveis:", data);

    // Esconder loading
    hideLoading();

    // Exibir resultados
    displayResetResults(data);
  } catch (error) {
    console.error("Erro ao resetar níveis:", error);
    // Esconder loading em caso de erro
    hideLoading();
    alert(`Erro ao resetar níveis: ${error.message}`);
  }
}

// Função para exibir loading personalizado
function showCustomLoading(message) {
  // Primeiro remover qualquer loading existente
  hideLoading();

  // Criar elemento de loading personalizado
  const loadingContent = `
    <div id="customLoadingOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" role="dialog" aria-label="Tela de carregamento">
      <div class="bg-white p-6 rounded-lg shadow-xl text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" aria-hidden="true"></div>
        <p class="text-lg font-semibold text-gray-700">${message}</p>
        <p class="text-sm text-gray-500 mt-2">Isso pode levar algum tempo dependendo da quantidade de IDs.</p>
        <div class="mt-3 text-xs text-gray-400">Não feche o navegador durante o processamento.</div>
      </div>
    </div>
  `;

  // Adicionar ao corpo do documento
  const loadingContainer = document.createElement("div");
  loadingContainer.innerHTML = loadingContent;
  document.body.appendChild(loadingContainer.firstElementChild);
}

// Atualização na função displayResetResults para garantir que o loading seja ocultado
function displayResetResults(data) {
  // Garantir que o loading seja ocultado
  hideLoading();

  const successCount = data.successCount;
  const errorCount = data.errorCount;
  const total = data.totalProcessed;

  const modalContent = `
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Resultado do Reset de Níveis</h2>
        
        <div class="mb-4">
          <p class="font-medium">Total processado: ${total}</p>
          <p class="text-green-600">Sucessos: ${successCount}</p>
          <p class="text-red-600">Erros: ${errorCount}</p>
        </div>
        
        ${
          errorCount > 0
            ? `
          <div class="mt-4 border-t pt-4">
            <h3 class="font-medium mb-2">Detalhes dos erros:</h3>
            <ul class="text-sm text-red-600 list-disc pl-5">
              ${data.results.errors
                .map(
                  (err) => `
                <li>ID ${err.personId}: ${err.error}</li>
              `
                )
                .join("")}
            </ul>
          </div>
        `
            : ""
        }
        
        <button onclick="this.parentElement.parentElement.remove();" class="mt-6 w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition">
          Fechar
        </button>
      </div>
    </div>
  `;

  // Criar um elemento div para o modal e adicionar ao corpo do documento
  const modalContainer = document.createElement("div");
  modalContainer.innerHTML = modalContent;
  document.body.appendChild(modalContainer.firstElementChild);
}

// Função auxiliar para ocultar qualquer tipo de loading
function hideLoading() {
  // Remover o loading padrão
  const standardLoading = document.getElementById("loadingOverlay");
  if (standardLoading) {
    standardLoading.classList.add("hidden");
  }

  // Remover o loading personalizado se existir
  const customLoading = document.getElementById("customLoadingOverlay");
  if (customLoading) {
    customLoading.remove();
  }
}

// Função para exibir os resultados do reset
function displayResetResults(data) {
  const successCount = data.successCount;
  const errorCount = data.errorCount;
  const total = data.totalProcessed;

  const modalContent = `
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Resultado do Reset de Níveis</h2>
        
        <div class="mb-4">
          <p class="font-medium">Total processado: ${total}</p>
          <p class="text-green-600">Sucessos: ${successCount}</p>
          <p class="text-red-600">Erros: ${errorCount}</p>
        </div>
        
        ${
          errorCount > 0
            ? `
          <div class="mt-4 border-t pt-4">
            <h3 class="font-medium mb-2">Detalhes dos erros:</h3>
            <ul class="text-sm text-red-600 list-disc pl-5">
              ${data.results.errors
                .map(
                  (err) => `
                <li>ID ${err.personId}: ${err.error}</li>
              `
                )
                .join("")}
            </ul>
          </div>
        `
            : ""
        }
        
        <button onclick="this.parentElement.parentElement.remove(); hideLoading();" class="mt-6 w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition">
          Fechar
        </button>
      </div>
    </div>
  `;

  // Criar um elemento div para o modal e adicionar ao corpo do documento
  const modalContainer = document.createElement("div");
  modalContainer.innerHTML = modalContent;
  document.body.appendChild(modalContainer.firstElementChild);
}

//RESET NIVEl

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
