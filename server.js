const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

// Inicialização do Express
const app = express();

// Configuração do Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads");
    }
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// Função para formatar data
function formatDate(dateStr) {
  try {
    if (!dateStr) return "";
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
}

// Função para verificar se a estrutura existe
async function checkStructureExists(structureId, headers) {
  try {
    const response = await axios.get(
      `https://platform.senior.com.br/t/senior.com.br/sam/1.0/organizationalstructure/${structureId}`,
      { headers }
    );
    return { exists: true, data: response.data };
  } catch (error) {
    if (error.response?.status === 404) {
      return {
        exists: false,
        error: `Estrutura organizacional ${structureId} não encontrada`,
      };
    }
    throw error;
  }
}

// Função para verificar se o cartão já existe
async function checkCardExists(cardNumber, headers) {
  try {
    // Tenta criar um payload mínimo para verificar o cartão
    const cardPayload = {
      cardNumber: cardNumber,
      person: { id: 0 }, // ID temporário
      id: 0,
      cardTechnology: 0,
      cardCredentialList: [
        {
          cardTechnology: 0,
          cardNumber: cardNumber,
        },
      ],
    };

    // Tenta criar o cartão - se já existir, a API retornará erro
    const response = await axios.post(
      "https://platform.senior.com.br/t/senior.com.br/sam/1.0/credential/card?situationConflictResolution=VALIDATE_PROVISORY_CREDENTIAL",
      cardPayload,
      { headers }
    );

    // Se chegou aqui, o cartão não existe
    return { exists: false };
  } catch (error) {
    // Se a API retornar erro específico de cartão já existente
    if (error.response?.data?.message?.includes("já se encontra")) {
      return { exists: true, error: error.response.data.message };
    }

    // Para outros erros relacionados ao cartão
    if (
      error.response?.data?.message?.includes("cartão") ||
      error.response?.data?.message?.includes("crachá")
    ) {
      return { exists: true, error: error.response.data.message };
    }

    // Para outros tipos de erro, não considera como "cartão existe"
    console.error(
      "Erro ao verificar cartão:",
      error.response?.data || error.message
    );
    return { exists: false };
  }
}

// Rota de teste
app.get("/api/test", (req, res) => {
  res.json({ status: "Server is running" });
});

// Rota de login
app.post("/api/login", async (req, res) => {
  try {
    console.log("Login attempt for user:", req.body.username);
    const response = await axios.post(
      "https://platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/platform/authentication/actions/login",
      req.body,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    console.log("Login successful");
    res.json(response.data);
  } catch (error) {
    console.error("Login error:", error.response?.data || error.message);
    res.status(401).json({
      error: "Authentication failed",
      details: error.response?.data?.message || error.message,
    });
  }
});

// Rota de upload do CSV
app.post("/api/upload", upload.single("file"), async (req, res) => {
  console.log("Upload endpoint hit");

  if (!req.file) {
    console.log("No file received");
    return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
  }

  // Verificar e formatar o token de autorização
  let authHeader = req.headers.authorization;
  console.log(
    "Original auth header:",
    authHeader ? `${authHeader.substring(0, 20)}...` : "None"
  );

  // Garantir que o token está no formato correto
  if (authHeader && !authHeader.startsWith("Bearer ")) {
    authHeader = `Bearer ${authHeader}`;
  }

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Token de autorização não fornecido" });
  }

  const results = {
    success: [],
    errors: [],
  };

  try {
    const fileContent = fs.readFileSync(req.file.path, "utf-8");
    console.log("File content:", fileContent);

    const records = parse(fileContent, {
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log("Parsed records:", JSON.stringify(records, null, 2));

    // Headers padrão para todas as requisições
    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    for (const record of records) {
      try {
        console.log("Processing record:", record);

        // Validações básicas
        if (!record.name?.trim()) throw new Error("Nome é obrigatório");
        if (!record.cpf?.trim()) throw new Error("CPF é obrigatório");
        if (!record.cardNumber?.trim())
          throw new Error("Número do cartão é obrigatório");
        if (!record.organizationalStructure1)
          throw new Error("Estrutura organizacional é obrigatória");

        const structureId = parseInt(record.organizationalStructure1);
        const cardNumber = parseInt(record.cardNumber);

        try {
          // Primeiro verifica o cartão
          console.log(`Verificando cartão ${cardNumber}`);
          const cardCheck = await checkCardExists(cardNumber, headers);
          if (cardCheck.exists) {
            throw new Error(cardCheck.error);
          }

          // Depois verifica a estrutura
          console.log(`Verificando estrutura ${structureId}`);
          const structureCheck = await checkStructureExists(
            structureId,
            headers
          );
          if (!structureCheck.exists) {
            throw new Error(structureCheck.error);
          }

          // Se chegou aqui, tanto o cartão quanto a estrutura são válidos
          const cpf = record.cpf.replace(/[^\d]/g, "");

          const personPayload = {
            person: {
              id: 0,
              name: record.name.trim(),
              gender: parseInt(record.gender) || 0,
              documents: [
                {
                  id: 0,
                  documentType: {
                    id: 1,
                    required: true,
                  },
                  document: cpf,
                },
              ],
              // Novo campo: emails
              emails: [
                {
                  id: 0,
                  preferential: true,
                  emailAddress: record.email || "", // Adiciona email do CSV ou string vazia
                },
              ],
              // Novo campo: registry
              registry: record.registry || "",
              situation: 0,
            },
            role: {
              id: parseInt(record.roleId) || 0,
            },
          };

          console.log(
            "Person payload:",
            JSON.stringify(personPayload, null, 2)
          );

          // Criar pessoa
          const personResponse = await axios.post(
            "https://platform.senior.com.br/t/senior.com.br/sam/1.0/person/createwithrange",
            personPayload,
            { headers }
          );

          console.log("Person created:", personResponse.data);

          if (!personResponse.data?.person?.id) {
            throw new Error("ID da pessoa não retornado pela API");
          }

          // Formatação da data
          const expirationDate = record.expirationDate
            ? formatDate(record.expirationDate)
            : "";
          const cardTechnology = parseInt(record.cardTechnology) || 0;

          // Registrar credencial
          const credentialPayload = {
            cardNumber: cardNumber,
            person: {
              id: personResponse.data.person.id,
            },
            id: 0,
            expirationDate: expirationDate,
            cardTechnology: cardTechnology,
            cardCredentialList: [
              {
                cardTechnology: cardTechnology,
                cardNumber: cardNumber,
              },
            ],
          };

          console.log(
            "Credential payload:",
            JSON.stringify(credentialPayload, null, 2)
          );

          const credentialResponse = await axios.post(
            "https://platform.senior.com.br/t/senior.com.br/sam/1.0/credential/card?situationConflictResolution=VALIDATE_PROVISORY_CREDENTIAL",
            credentialPayload,
            { headers }
          );

          console.log("Credential created:", credentialResponse.data);

          // Adicionar estrutura organizacional
          const individualPayload = {
            person: {
              id: personResponse.data.person.id,
            },
            organizationalStructure: {
              id: structureId,
            },
          };

          const structureResponse = await axios.post(
            `https://platform.senior.com.br/t/senior.com.br/sam/1.0/person/${personResponse.data.person.id}/organizationalstructure/${structureId}`,
            individualPayload,
            { headers }
          );

          console.log("Structure added successfully:", structureResponse.data);

          // Adicionar ao resultado de sucesso
          results.success.push({
            name: record.name,
            cpf: cpf,
            cardNumber: cardNumber,
            personId: personResponse.data.person.id,
            organizationalStructures: [
              {
                structureId: structureId.toString(),
                status: "Sucesso",
              },
            ],
          });
        } catch (validationError) {
          throw validationError;
        }
      } catch (error) {
        console.error("Error processing record:", error);
        results.errors.push({
          name: record.name || "Unknown",
          cpf: record.cpf || "Unknown",
          error: error.response?.data?.message || error.message,
        });
      }
    }

    // Limpar arquivo após processamento
    fs.unlinkSync(req.file.path);
    console.log("Final results:", results);
    res.json(results);
  } catch (error) {
    console.error("Fatal error:", error);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: "Error processing CSV file",
      details: error.message,
    });
  }
});

// Rota para importar empresas terceirizadas
app.post("/api/import-companies", upload.single("file"), async (req, res) => {
  console.log("Import companies endpoint hit");

  if (!req.file) {
    console.log("No file received");
    return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
  }

  // Verificar e formatar o token de autorização
  let authHeader = req.headers.authorization;

  if (authHeader && !authHeader.startsWith("Bearer ")) {
    authHeader = `Bearer ${authHeader}`;
  }

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Token de autorização não fornecido" });
  }

  const results = {
    success: [],
    errors: [],
  };

  try {
    const fileContent = fs.readFileSync(req.file.path, "utf-8");
    console.log("File content (companies):", fileContent);

    const records = parse(fileContent, {
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log("Parsed company records:", JSON.stringify(records, null, 2));

    // Headers padrão para todas as requisições
    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    for (const record of records) {
      try {
        console.log("Processing company record:", record);

        // Identificar os campos corretos, independentemente de caracteres especiais
        const tradeName = record.tradeName?.trim();

        // Procurar por campos que começam com 'companyName', independentemente de caracteres extras
        let companyName = "";
        for (const key in record) {
          if (key.startsWith("companyName")) {
            companyName = record[key]?.trim();
            break;
          }
        }

        // Procurar por campos que começam com 'document', independentemente de caracteres extras
        let document = "";
        for (const key in record) {
          if (key.startsWith("document") && key !== "documentType") {
            document = record[key]?.trim();
            break;
          }
        }

        // Procurar por campos que começam com 'workflowProcessId', independentemente de caracteres extras
        let workflowProcessId = 0;
        for (const key in record) {
          if (key.startsWith("workflowProcessId")) {
            workflowProcessId = record[key];
            break;
          }
        }

        // Validações básicas com os campos encontrados
        if (!tradeName) throw new Error("Nome fantasia é obrigatório");
        if (!companyName) throw new Error("Razão social é obrigatória");
        if (!document) throw new Error("Documento é obrigatório");
        if (!workflowProcessId) throw new Error("ID do workflow é obrigatório");

        // Preparar payload da empresa no formato 
        const companyPayload = {
          tradeName: tradeName,
          companyName: companyName,
          document: document,
          phone: record.phone || "",
          email: record.email || "",
          address: record.address || "",
          district: record.district || "",
          city: record.city || "",
          federalState: record.federalState || "",
          zipCode: record.zipCode ? record.zipCode.replace(/[^\d]/g, "") : "",
          country: record.country || "Brasil",
          number: parseInt(record.number) || 0,
          complement: record.complement || "",
          workflowProcessId: parseInt(workflowProcessId),
        };

        console.log(
          "Company payload:",
          JSON.stringify(companyPayload, null, 2)
        );

        // Enviar para a API exatamente conforme fornecido
        try {
          const response = await axios.post(
            "https://platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/sam/application/entities/thirdPartyCompany",
            companyPayload,
            { headers }
          );

          console.log("Company created:", response.data);

          // Adicionar ao resultado de sucesso
          results.success.push({
            tradeName: record.tradeName,
            companyName: companyName,
            document: document,
            id: response.data.id || "ID não disponível",
          });
        } catch (error) {
          // Tratamento de erro existente
          console.error("Error processing company record:", error);

          let errorMessage = "Erro desconhecido";

          if (error.response) {
            console.error(
              "API Response error data:",
              JSON.stringify(error.response.data, null, 2)
            );
            console.error("API Response status:", error.response.status);

            if (error.response.data && error.response.data.message) {
              errorMessage = error.response.data.message;
            }
          } else if (error.request) {
            errorMessage =
              "Não foi possível conectar ao servidor da Senior. Verifique sua conexão.";
          } else {
            errorMessage = error.message;
          }

          results.errors.push({
            tradeName: record.tradeName || "Unknown",
            companyName: companyName || "Unknown",
            document: document || "Unknown",
            error: errorMessage,
          });
        }
      } catch (error) {
        console.error("Error processing company record:", error);
        results.errors.push({
          tradeName: record.tradeName || "Unknown",
          companyName: "Unknown",
          document: "Unknown",
          error: error.message,
        });
      }
    }

    // Limpar arquivo após processamento
    fs.unlinkSync(req.file.path);
    console.log("Final company results:", results);
    res.json(results);
  } catch (error) {
    console.error("Fatal error processing companies:", error);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: "Error processing CSV file",
      details: error.message,
    });
  }
});

// Rota para importar contratos
app.post("/api/import-contracts", upload.single("file"), async (req, res) => {
  console.log("Import contracts endpoint hit");

  if (!req.file) {
    console.log("No file received");
    return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
  }

  // Verificar e formatar o token de autorização
  let authHeader = req.headers.authorization;

  if (authHeader && !authHeader.startsWith("Bearer ")) {
    authHeader = `Bearer ${authHeader}`;
  }

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Token de autorização não fornecido" });
  }

  const results = {
    success: [],
    errors: [],
  };

  try {
    const fileContent = fs.readFileSync(req.file.path, "utf-8");
    console.log("File content (contracts):", fileContent);

    const records = parse(fileContent, {
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log("Parsed contract records:", JSON.stringify(records, null, 2));

    // Headers padrão para todas as requisições
    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    for (const record of records) {
      try {
        console.log("Processing contract record:", record);

        // Validações básicas
        if (!record.thirdPartyCompanyId)
          throw new Error("ID da empresa terceirizada é obrigatório");
        if (!record.contractTypeId)
          throw new Error("ID do tipo de contrato é obrigatório");
        if (!record.contractNumber?.trim())
          throw new Error("Número do contrato é obrigatório");
        if (!record.startDate?.trim())
          throw new Error("Data inicial é obrigatória");
        if (!record.workflowProcessId)
          throw new Error("ID do workflow é obrigatório");
        if (!record.defaultRoleId)
          throw new Error("ID do papel padrão é obrigatório");

        // Função para formatar data
        function formatContractDate(dateStr) {
          try {
            if (!dateStr) return "";
            const [day, month, year] = dateStr.split("/");
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          } catch (error) {
            console.error("Error formatting contract date:", error);
            throw new Error("Data em formato inválido. Use DD/MM/AAAA");
          }
        }

        // Formatar datas
        const startDate = formatContractDate(record.startDate);
        const endDate = record.endDate
          ? formatContractDate(record.endDate)
          : "";

        // Preparar payload do contrato
        const contractPayload = {
          thirdPartyCompany: {
            id: parseInt(record.thirdPartyCompanyId),
            workflowProcessId: parseInt(record.workflowProcessId),
          },
          contractType: {
            id: parseInt(record.contractTypeId),
          },
          contractNumber: record.contractNumber.trim(),
          description: record.description || "",
          startDate: startDate,
          endDate: endDate || null,
          situation: record.situation === "false" ? false : true,
          responsibleName: record.responsibleName || "",
          phone: record.phone || "",
          email: record.email || "",
          workflowProcessId: parseInt(record.workflowProcessId),
          login: record.login || "",
          defaultRole: {
            id: parseInt(record.defaultRoleId),
          },
        };

        try {
          console.log(
            "Contract payload:",
            JSON.stringify(contractPayload, null, 2)
          );

          // Enviar para a API
          const response = await axios.post(
            "https://platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/sam/third/entities/contract",
            contractPayload,
            { headers }
          );

          console.log("Contract created:", response.data);

          // Adicionar ao resultado de sucesso
          results.success.push({
            contractNumber: record.contractNumber,
            companyId: record.thirdPartyCompanyId,
            id: response.data.id || "ID não disponível",
          });
        } catch (error) {
          // Tratamento de erro melhorado
          console.error("Error processing contract record:", error);

          let errorMessage = "Erro desconhecido";

          // Verificar se é um erro de resposta da API
          if (error.response) {
            console.error(
              "API Response error data:",
              JSON.stringify(error.response.data, null, 2)
            );
            console.error("API Response status:", error.response.status);

            // Extrair mensagem de erro mais específica
            if (error.response.data && error.response.data.message) {
              errorMessage = error.response.data.message;

              // Se o erro for relacionado a contrato duplicado
              if (
                errorMessage.toLowerCase().includes("contrato") &&
                errorMessage.toLowerCase().includes("já existe")
              ) {
                errorMessage = `Contrato ${record.contractNumber} já está cadastrado no sistema`;
              }
              // Se o erro for relacionado a empresa terceirizada
              else if (
                errorMessage.toLowerCase().includes("empresa") ||
                errorMessage.toLowerCase().includes("terceirizada")
              ) {
                errorMessage = `Empresa ID ${record.thirdPartyCompanyId} não encontrada ou inválida`;
              }
              // Se o erro for relacionado a workflow
              else if (errorMessage.toLowerCase().includes("workflow")) {
                errorMessage = `ID de workflow ${record.workflowProcessId} inválido ou não encontrado`;
              }
            }
          } else if (error.request) {
            // Erro de conexão - a requisição foi feita mas não houve resposta
            errorMessage =
              "Não foi possível conectar ao servidor da Senior. Verifique sua conexão.";
          } else {
            // Erro na configuração da requisição
            errorMessage = error.message;
          }

          results.errors.push({
            contractNumber: record.contractNumber || "Unknown",
            companyId: record.thirdPartyCompanyId || "Unknown",
            error: errorMessage,
          });
        }
      } catch (error) {
        console.error("Error processing contract record:", error);
        results.errors.push({
          contractNumber: record.contractNumber || "Unknown",
          companyId: record.thirdPartyCompanyId || "Unknown",
          error: error.message,
        });
      }
    }

    // Limpar arquivo após processamento
    fs.unlinkSync(req.file.path);
    console.log("Final contract results:", results);
    res.json(results);
  } catch (error) {
    console.error("Fatal error processing contracts:", error);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: "Error processing CSV file",
      details: error.message,
    });
  }
});

//Proprietaria

// Rota para obter informações de licença
app.get("/api/license-info", async (req, res) => {
  console.log("License info endpoint hit");

  // Verificar e formatar o token de autorização
  let authHeader = req.headers.authorization;

  if (authHeader && !authHeader.startsWith("Bearer ")) {
    authHeader = `Bearer ${authHeader}`;
  }

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Token de autorização não fornecido" });
  }

  try {
    // Headers padrão para requisição
    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Enviar a requisição para a API da Senior
    try {
      const response = await axios.get(
        "https://platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/sam/application/queries/getLicenseInfo",
        { headers }
      );

      console.log("License info retrieved successfully");

      // Retornar os dados da resposta
      res.json(response.data);
    } catch (apiError) {
      console.error(
        "API error details:",
        apiError.response?.data || apiError.message
      );

      res.status(apiError.response?.status || 500).json({
        success: false,
        message: "Erro ao obter informações de licença",
        error: apiError.response?.data || apiError.message,
      });
    }
  } catch (error) {
    console.error("Fatal error getting license info:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao obter informações de licença",
      error: error.message,
    });
  }
});

//Proprietaria

//RESET NIVEL

// Rota para resetar nível e antipassback de pessoas
app.post("/api/reset-level", async (req, res) => {
  console.log("Reset level endpoint hit");

  // Verificar e formatar o token de autorização
  let authHeader = req.headers.authorization;

  if (authHeader && !authHeader.startsWith("Bearer ")) {
    authHeader = `Bearer ${authHeader}`;
  }

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Token de autorização não fornecido" });
  }

  // Obter os IDs inicial e final do corpo da requisição
  const { startId, endId } = req.body;

  if (!startId || !endId) {
    return res
      .status(400)
      .json({ error: "IDs inicial e final são obrigatórios" });
  }

  // Converter para números
  const start = parseInt(startId);
  const end = parseInt(endId);

  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({ error: "IDs devem ser números válidos" });
  }

  if (start > end) {
    return res
      .status(400)
      .json({ error: "ID inicial deve ser menor ou igual ao ID final" });
  }

  try {
    // Headers padrão para requisição
    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const results = {
      success: [],
      errors: [],
    };

    // Iterar sobre o intervalo de IDs e fazer a requisição para cada um
    for (let personId = start; personId <= end; personId++) {
      try {
        console.log(`Resetando nível para pessoa ID ${personId}`);

        const response = await axios.post(
          "https://platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/sam/application/actions/resetPersonLevelAndAntiPassback",
          { personId },
          { headers }
        );

        console.log(`Nível resetado com sucesso para pessoa ID ${personId}`);
        results.success.push(personId);
      } catch (error) {
        console.error(
          `Erro ao resetar nível para pessoa ID ${personId}:`,
          error.response?.data || error.message
        );
        results.errors.push({
          personId,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    // Retornar os resultados
    res.json({
      message: `Operação concluída para o intervalo de IDs ${start} a ${end}`,
      totalProcessed: end - start + 1,
      successCount: results.success.length,
      errorCount: results.errors.length,
      results,
    });
  } catch (error) {
    console.error("Fatal error in reset level:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno ao resetar níveis",
      error: error.message,
    });
  }
});

//RESET NIVEL

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Erro interno do servidor",
    details: err.message,
  });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
