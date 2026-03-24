const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CRM Sanavit Ecuador API',
      version: '2.0.0',
      description:
        'API REST del CRM Sanavit Ecuador. Gestiona leads, ventas, cartera, comisiones, nomina, SAC e inventario.',
      contact: {
        name: 'Equipo Sanavit',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Desarrollo local',
      },
      {
        url: 'https://crm-sanavit-production.up.railway.app',
        description: 'Produccion Railway',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en POST /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensaje de error' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                pages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Autenticacion y sesion' },
      { name: 'Personas', description: 'Gestion de personas / clientes' },
      { name: 'Leads', description: 'Gestion de leads y llamadas' },
      { name: 'Ventas', description: 'Contratos y ventas' },
      { name: 'Cartera', description: 'Gestion de cartera y cobranza' },
      { name: 'Recibos', description: 'Pagos y recibos de caja' },
      { name: 'Comisiones', description: 'Comisiones de consultores' },
      { name: 'Nomina', description: 'Calculo de nomina mensual' },
      { name: 'SAC', description: 'Servicio al Cliente — tickets PQR' },
      { name: 'Inventario', description: 'Productos e inventario' },
      { name: 'Admin', description: 'Administracion de usuarios, salas, roles y webhooks' },
      { name: 'KPIs', description: 'Indicadores y analiticas' },
      { name: 'Reportes', description: 'Reportes y exportaciones' },
      { name: 'Outsourcing', description: 'Empresas outsourcing' },
      { name: 'Consultor', description: 'Vista del consultor' },
      { name: 'Importar', description: 'Importacion masiva de bases' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'CRM Sanavit — API Docs',
    })
  );

  // Endpoint para obtener el spec JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

module.exports = { setupSwagger, swaggerSpec };
