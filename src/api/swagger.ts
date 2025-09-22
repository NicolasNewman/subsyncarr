import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJsdoc.OAS3Options = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Subsyncarr API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        authorization: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'API key for authentication',
        },
      },
    },
    security: [
      {
        authorization: [],
      },
    ],
    externalDocs: {
      url: 'https://github.com/johnpc/subsyncarr',
      description: 'Project Repository',
    },
  },
  apis: ['./src/api/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
