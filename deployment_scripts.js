#!/usr/bin/env node

/**
 * CodeGuardian Deployment Script
 * This script automates the setup and deployment of all CodeGuardian components
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create an interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

// Configuration options
const DEFAULT_CONFIG = {
  azureRegion: 'eastus',
  cosmosDbName: 'codeguardian',
  functionAppName: 'codeguardian-functions',
  containerAppName: 'codeguardian-app',
  resourceGroup: 'codeguardian-rg',
  openAiDeploymentName: 'codeguardian-gpt4',
  openAiModelName: 'gpt-4',
};

/**
 * Main deployment function
 */
async function deploy() {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║           CodeGuardian Setup          ║
  ╚═══════════════════════════════════════╝
  `);

  try {
    // Check prerequisites
    checkPrerequisites();
    
    // Get configuration
    const config = await getConfiguration();
    
    // Create resource group if it doesn't exist
    await createResourceGroup(config);
    
    // Deploy resources
    await deployAzureResources(config);
    
    // Deploy GitHub App
    await deployGitHubApp(config);
    
    // Deploy Frontend
    await deployFrontend(config);
    
    // Print summary and next steps
    printSummary(config);
    
    rl.close();
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    rl.close();
    process.exit(1);
  }
}

/**
 * Check that all prerequisites are installed
 */
function checkPrerequisites() {
  console.log('Checking prerequisites...');
  
  try {
    // Check if Azure CLI is installed
    execSync('az --version', { stdio: 'ignore' });
    
    // Check if Node.js is installed
    execSync('node --version', { stdio: 'ignore' });
    
    // Check if npm is installed
    execSync('npm --version', { stdio: 'ignore' });
    
    console.log('✅ All prerequisites are installed.\n');
  } catch (error) {
    throw new Error('Missing prerequisites. Please make sure Azure CLI, Node.js, and npm are installed.');
  }
}

/**
 * Get configuration from user input or environment variables
 */
async function getConfiguration() {
  console.log('Setting up configuration...');
  
  const config = { ...DEFAULT_CONFIG };
  
  // Try to get values from environment variables first
  config.azureSubscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  config.azureTenantId = process.env.AZURE_TENANT_ID;
  config.githubAppId = process.env.GITHUB_APP_ID;
  config.githubPrivateKey = process.env.GITHUB_PRIVATE_KEY;
  config.githubClientId = process.env.GITHUB_CLIENT_ID;
  config.githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  
  // Ask for any missing values
  if (!config.azureSubscriptionId) {
    try {
      const subscriptionOutput = execSync('az account show --query id -o tsv').toString().trim();
      config.azureSubscriptionId = subscriptionOutput;
    } catch (error) {
      config.azureSubscriptionId = await question('Enter your Azure Subscription ID: ');
    }
  }
  
  if (!config.azureTenantId) {
    try {
      const tenantOutput = execSync('az account show --query tenantId -o tsv').toString().trim();
      config.azureTenantId = tenantOutput;
    } catch (error) {
      config.azureTenantId = await question('Enter your Azure Tenant ID: ');
    }
  }
  
  // Resource group location
  config.location = await question(`Enter Azure region (default: ${config.azureRegion}): `) || config.azureRegion;
  
  // Resource group name
  config.resourceGroup = await question(`Enter resource group name (default: ${config.resourceGroup}): `) || config.resourceGroup;
  
  // Ask about GitHub App if not configured
  if (!config.githubAppId) {
    console.log('\n📝 GitHub App Configuration');
    console.log('------------------------');
    console.log('You need to create a GitHub App for CodeGuardian.');
    console.log('Please follow these steps:');
    console.log('1. Go to your GitHub account settings → Developer settings → GitHub Apps');
    console.log('2. Create a new GitHub App with the required permissions');
    console.log('3. Generate a private key');
    console.log('4. Note the App ID, Client ID, and Client Secret\n');
    
    const hasGithubApp = await question('Do you already have a GitHub App created? (y/n): ');
    
    if (hasGithubApp.toLowerCase() === 'y') {
      config.githubAppId = await question('Enter your GitHub App ID: ');
      config.githubClientId = await question('Enter your GitHub Client ID: ');
      config.githubClientSecret = await question('Enter your GitHub Client Secret: ');
      
      const privateKeyPath = await question('Enter the path to your GitHub App private key file: ');
      try {
        config.githubPrivateKey = fs.readFileSync(privateKeyPath, 'utf8');
      } catch (error) {
        throw new Error(`Failed to read GitHub private key file: ${error.message}`);
      }
    } else {
      console.log('\n⚠️ You need to create a GitHub App before continuing.');
      console.log('The deployment will create placeholder values for now,');
      console.log('but you will need to update them later.\n');
      
      config.githubAppId = 'placeholder-app-id';
      config.githubClientId = 'placeholder-client-id';
      config.githubClientSecret = 'placeholder-client-secret';
      config.githubPrivateKey = 'placeholder-private-key';
    }
  }
  
  console.log('✅ Configuration completed.\n');
  return config;
}

/**
 * Create Azure resource group
 */
async function createResourceGroup(config) {
  console.log(`Creating resource group "${config.resourceGroup}"...`);
  
  try {
    execSync(`az group create --name ${config.resourceGroup} --location ${config.location}`);
    console.log('✅ Resource group created.\n');
  } catch (error) {
    throw new Error(`Failed to create resource group: ${error.message}`);
  }
}

/**
 * Deploy Azure resources using an ARM template
 */
async function deployAzureResources(config) {
  console.log('Deploying Azure resources...');
  
  // Create ARM template
  const armTemplatePath = path.join(process.cwd(), 'deploy', 'azuredeploy.json');
  
  // Check if template exists, if not create it
  if (!fs.existsSync(armTemplatePath)) {
    console.log('ARM template not found. Creating deploy directory and template...');
    
    // Create deploy directory if it doesn't exist
    const deployDir = path.join(process.cwd(), 'deploy');
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir);
    }
    
    // Write ARM template
    fs.writeFileSync(armTemplatePath, JSON.stringify(createArmTemplate(config), null, 2));
  }
  
  // Create parameters file
  const parametersPath = path.join(process.cwd(), 'deploy', 'azuredeploy.parameters.json');
  fs.writeFileSync(parametersPath, JSON.stringify(createArmParameters(config), null, 2));
  
  // Deploy ARM template
  try {
    execSync(`az deployment group create \
      --resource-group ${config.resourceGroup} \
      --template-file ${armTemplatePath} \
      --parameters @${parametersPath}`, 
      { stdio: 'inherit' });
    
    console.log('✅ Azure resources deployed.\n');
    
    // Get deployment outputs
    const outputsJson = execSync(`az deployment group show \
      --resource-group ${config.resourceGroup} \
      --name azuredeploy \
      --query properties.outputs \
      -o json`).toString();
    
    const outputs = JSON.parse(outputsJson);
    
    // Update config with outputs
    config.cosmosDbEndpoint = outputs.cosmosDbEndpoint.value;
    config.cosmosDbKey = outputs.cosmosDbKey.value;
    config.openAiEndpoint = outputs.openAiEndpoint.value;
    config.openAiKey = outputs.openAiKey.value;
    config.functionAppHostname = outputs.functionAppHostname.value;
    
  } catch (error) {
    throw new Error(`Failed to deploy Azure resources: ${error.message}`);
  }
}

/**
 * Deploy GitHub App
 */
async function deployGitHubApp(config) {
  console.log('Deploying GitHub App...');
  
  try {
    // Create .env file for GitHub App
    const envPath = path.join(process.cwd(), 'github-app', '.env');
    const envContent = `
# GitHub App Configuration
GITHUB_APP_ID=${config.githubAppId}
GITHUB_PRIVATE_KEY=${config.githubPrivateKey.replace(/\n/g, '\\n')}
GITHUB_WEBHOOK_SECRET=${Math.random().toString(36).substring(2, 15)}
GITHUB_CLIENT_ID=${config.githubClientId}
GITHUB_CLIENT_SECRET=${config.githubClientSecret}

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=${config.openAiEndpoint}
AZURE_OPENAI_KEY=${config.openAiKey}
AZURE_OPENAI_DEPLOYMENT=${config.openAiDeploymentName}

# Azure Cosmos DB
COSMOS_DB_ENDPOINT=${config.cosmosDbEndpoint}
COSMOS_DB_KEY=${config.cosmosDbKey}
COSMOS_DB_DATABASE=codeguardian
COSMOS_DB_CONTAINER=analysis-results

# Function App
FUNCTION_APP_URL=https://${config.functionAppHostname}
`;
    
    // Ensure the directory exists
    const appDir = path.join(process.cwd(), 'github-app');
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // Set up the GitHub App container
    console.log('Building GitHub App container...');
    
    // Create Dockerfile if it doesn't exist
    const dockerfilePath = path.join(appDir, 'Dockerfile');
    if (!fs.existsSync(dockerfilePath)) {
      const dockerfileContent = `FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
`;
      
      fs.writeFileSync(dockerfilePath, dockerfileContent);
    }
    
    // Deploy to Azure Container Apps
    console.log('Deploying to Azure Container Apps...');
    
    // Create container registry if it doesn't exist
    const acrName = `codeguardianacr${Math.floor(Math.random() * 10000)}`;
    execSync(`az acr create \
      --resource-group ${config.resourceGroup} \
      --name ${acrName} \
      --sku Basic \
      --admin-enabled true`);
    
    // Get ACR credentials
    const acrCredentials = JSON.parse(execSync(`az acr credential show \
      --resource-group ${config.resourceGroup} \
      --name ${acrName} \
      -o json`).toString());
    
    // Build and push container
    execSync(`az acr build \
      --registry ${acrName} \
      --resource-group ${config.resourceGroup} \
      --image codeguardian-app:latest \
      ${appDir}`, 
      { stdio: 'inherit' });
    
    // Create Container App
    execSync(`az containerapp create \
      --resource-group ${config.resourceGroup} \
      --name ${config.containerAppName} \
      --image ${acrName}.azurecr.io/codeguardian-app:latest \
      --registry-server ${acrName}.azurecr.io \
      --registry-username ${acrCredentials.username} \
      --registry-password "${acrCredentials.passwords[0].value}" \
      --target-port 3000 \
      --ingress external \
      --env-vars "GITHUB_APP_ID=${config.githubAppId}" "AZURE_OPENAI_ENDPOINT=${config.openAiEndpoint}" "COSMOS_DB_ENDPOINT=${config.cosmosDbEndpoint}"`, 
      { stdio: 'inherit' });
    
    // Get Container App URL
    const containerAppUrl = execSync(`az containerapp show \
      --resource-group ${config.resourceGroup} \
      --name ${config.containerAppName} \
      --query properties.configuration.ingress.fqdn \
      -o tsv`).toString().trim();
    
    config.githubAppUrl = `https://${containerAppUrl}`;
    
    console.log(`✅ GitHub App deployed at ${config.githubAppUrl}\n`);
  } catch (error) {
    throw new Error(`Failed to deploy GitHub App: ${error.message}`);
  }
}

/**
 * Deploy frontend application
 */
async function deployFrontend(config) {
  console.log('Deploying frontend application...');
  
  try {
    // Create .env file for frontend
    const frontendDir = path.join(process.cwd(), 'frontend');
    if (!fs.existsSync(frontendDir)) {
      fs.mkdirSync(frontendDir, { recursive: true });
    }
    
    const envPath = path.join(frontendDir, '.env');
    const envContent = `
REACT_APP_API_BASE_URL=${config.githubAppUrl}/api
`;
    
    fs.writeFileSync(envPath, envContent);
    
    // Create build configuration
    console.log('You can build and deploy the frontend with:');
    console.log(`cd ${frontendDir}`);
    console.log(`npm install`);
    console.log(`npm run build`);
    console.log(`az storage blob service-properties update --account-name <your-storage-account> --static-website --index-document index.html`);
    console.log(`az storage blob upload-batch -s build/ -d '$web' --account-name <your-storage-account>`);
    
    console.log('✅ Frontend deployment configured.\n');
  } catch (error) {
    throw new Error(`Failed to configure frontend deployment: ${error.message}`);
  }
}

/**
 * Print summary and next steps
 */
function printSummary(config) {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║        Deployment Summary             ║
  ╚═══════════════════════════════════════╝
  
  Resource Group: ${config.resourceGroup}
  Region: ${config.location}
  
  GitHub App URL: ${config.githubAppUrl || 'Not deployed'}
  Function App: ${config.functionAppHostname || 'Not deployed'}
  
  ╔═══════════════════════════════════════╗
  ║        Next Steps                     ║
  ╚═══════════════════════════════════════╝
  
  1. ${config.githubAppId === 'placeholder-app-id' ? 
    'Create a GitHub App and update the configuration' : 
    'Install the GitHub App on your repositories'}
  
  2. Complete the frontend deployment
  
  3. Test CodeGuardian by creating a pull request
  
  For more information, see the documentation at:
  https://github.com/your-org/codeguardian
  `);
}

/**
 * Create ARM template for Azure resources
 */
function createArmTemplate(config) {
  return {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
      "cosmosDbName": {
        "type": "string",
        "defaultValue": config.cosmosDbName
      },
      "functionAppName": {
        "type": "string",
        "defaultValue": config.functionAppName
      },
      "openAiModelName": {
        "type": "string",
        "defaultValue": config.openAiModelName
      },
      "openAiDeploymentName": {
        "type": "string",
        "defaultValue": config.openAiDeploymentName
      }
    },
    "variables": {
      "storageAccountName": "[concat('storage', uniqueString(resourceGroup().id))]",
      "hostingPlanName": "[concat(parameters('functionAppName'), '-plan')]",
      "applicationInsightsName": "[concat(parameters('functionAppName'), '-insights')]",
      "openAiAccountName": "[concat('openai', uniqueString(resourceGroup().id))]"
    },
    "resources": [
      {
        "type": "Microsoft.DocumentDB/databaseAccounts",
        "apiVersion": "2021-10-15",
        "name": "[parameters('cosmosDbName')]",
        "location": "[resourceGroup().location]",
        "kind": "GlobalDocumentDB",
        "properties": {
          "databaseAccountOfferType": "Standard",
          "consistencyPolicy": {
            "defaultConsistencyLevel": "Session"
          },
          "locations": [
            {
              "locationName": "[resourceGroup().location]",
              "failoverPriority": 0,
              "isZoneRedundant": false
            }
          ]
        }
      },
      {
        "type": "Microsoft.Storage/storageAccounts",
        "apiVersion": "2021-08-01",
        "name": "[variables('storageAccountName')]",
        "location": "[resourceGroup().location]",
        "sku": {
          "name": "Standard_LRS"
        },
        "kind": "StorageV2"
      },
      {
        "type": "Microsoft.Web/serverfarms",
        "apiVersion": "2021-03-01",
        "name": "[variables('hostingPlanName')]",
        "location": "[resourceGroup().location]",
        "sku": {
          "name": "Y1",
          "tier": "Dynamic"
        },
        "properties": {
          "reserved": true
        }
      },
      {
        "type": "Microsoft.Insights/components",
        "apiVersion": "2020-02-02",
        "name": "[variables('applicationInsightsName')]",
        "location": "[resourceGroup().location]",
        "kind": "web",
        "properties": {
          "Application_Type": "web",
          "Request_Source": "rest"
        }
      },
      {
        "type": "Microsoft.CognitiveServices/accounts",
        "apiVersion": "2021-10-01",
        "name": "[variables('openAiAccountName')]",
        "location": "[resourceGroup().location]",
        "sku": {
          "name": "S0"
        },
        "kind": "OpenAI",
        "properties": {
          "customSubDomainName": "[variables('openAiAccountName')]"
        }
      },
      {
        "type": "Microsoft.CognitiveServices/accounts/deployments",
        "apiVersion": "2021-10-01",
        "name": "[concat(variables('openAiAccountName'), '/', parameters('openAiDeploymentName'))]",
        "dependsOn": [
          "[resourceId('Microsoft.CognitiveServices/accounts', variables('openAiAccountName'))]"
        ],
        "properties": {
          "model": {
            "format": "OpenAI",
            "name": "[parameters('openAiModelName')]"
          },
          "scaleSettings": {
            "scaleType": "Standard"
          }
        }
      },
      {
        "type": "Microsoft.Web/sites",
        "apiVersion": "2021-03-01",
        "name": "[parameters('functionAppName')]",
        "location": "[resourceGroup().location]",
        "kind": "functionapp,linux",
        "dependsOn": [
          "[resourceId('Microsoft.Web/serverfarms', variables('hostingPlanName'))]",
          "[resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName'))]",
          "[resourceId('Microsoft.Insights/components', variables('applicationInsightsName'))]",
          "[resourceId('Microsoft.DocumentDB/databaseAccounts', parameters('cosmosDbName'))]",
          "[resourceId('Microsoft.CognitiveServices/accounts/deployments', variables('openAiAccountName'), parameters('openAiDeploymentName'))]"
        ],
        "properties": {
          "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('hostingPlanName'))]",
          "siteConfig": {
            "linuxFxVersion": "Node|16",
            "appSettings": [
              {
                "name": "AzureWebJobsStorage",
                "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', variables('storageAccountName'), ';EndpointSuffix=', environment().suffixes.storage, ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName')), '2021-08-01').keys[0].value)]"
              },
              {
                "name": "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING",
                "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', variables('storageAccountName'), ';EndpointSuffix=', environment().suffixes.storage, ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName')), '2021-08-01').keys[0].value)]"
              },
              {
                "name": "APPINSIGHTS_INSTRUMENTATIONKEY",
                "value": "[reference(resourceId('Microsoft.Insights/components', variables('applicationInsightsName')), '2020-02-02').InstrumentationKey]"
              },
              {
                "name": "FUNCTIONS_EXTENSION_VERSION",
                "value": "~4"
              },
              {
                "name": "FUNCTIONS_WORKER_RUNTIME",
                "value": "node"
              },
              {
                "name": "WEBSITE_NODE_DEFAULT_VERSION",
                "value": "~16"
              },
              {
                "name": "COSMOS_DB_ENDPOINT",
                "value": "[reference(resourceId('Microsoft.DocumentDB/databaseAccounts', parameters('cosmosDbName')), '2021-10-15').documentEndpoint]"
              },
              {
                "name": "COSMOS_DB_KEY",
                "value": "[listKeys(resourceId('Microsoft.DocumentDB/databaseAccounts', parameters('cosmosDbName')), '2021-10-15').primaryMasterKey]"
              },
              {
                "name": "AZURE_OPENAI_ENDPOINT",
                "value": "[reference(resourceId('Microsoft.CognitiveServices/accounts', variables('openAiAccountName')), '2021-10-01').endpoint]"
              },
              {
                "name": "AZURE_OPENAI_KEY",
                "value": "[listKeys(resourceId('Microsoft.CognitiveServices/accounts', variables('openAiAccountName')), '2021-10-01').key1]"
              },
              {
                "name": "AZURE_OPENAI_DEPLOYMENT",
                "value": "[parameters('openAiDeploymentName')]"
              }
            ]
          }
        }
      }
    ],
    "outputs": {
      "cosmosDbEndpoint": {
        "type": "string",
        "value": "[reference(resourceId('Microsoft.DocumentDB/databaseAccounts', parameters('cosmosDbName')), '2021-10-15').documentEndpoint]"
      },
      "cosmosDbKey": {
        "type": "string",
        "value": "[listKeys(resourceId('Microsoft.DocumentDB/databaseAccounts', parameters('cosmosDbName')), '2021-10-15').primaryMasterKey]"
      },
      "openAiEndpoint": {
        "type": "string",
        "value": "[reference(resourceId('Microsoft.CognitiveServices/accounts', variables('openAiAccountName')), '2021-10-01').endpoint]"
      },
      "openAiKey": {
        "type": "string",
        "value": "[listKeys(resourceId('Microsoft.CognitiveServices/accounts', variables('openAiAccountName')), '2021-10-01').key1]"
      },
      "functionAppHostname": {
        "type": "string",
        "value": "[reference(resourceId('Microsoft.Web/sites', parameters('functionAppName')), '2021-03-01').defaultHostName]"
      }
    }
  };
}

/**
 * Create ARM parameters for deployment
 */
function createArmParameters(config) {
  return {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
      "cosmosDbName": {
        "value": config.cosmosDbName
      },
      "functionAppName": {
        "value": config.functionAppName
      },
      "openAiModelName": {
        "value": config.openAiModelName
      },
      "openAiDeploymentName": {
        "value": config.openAiDeploymentName
      }
    }
  };
}

// Run the deployment
deploy().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
});