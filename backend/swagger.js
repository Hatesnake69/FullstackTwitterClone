const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User API',
      version: '1.0.0',
      description: 'A simple API for creating and retrieving users'
    },
    
    servers: [
      {
        url: 'http://localhost:3000'
      }
    ],
    components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: {
                type: 'string'
              },
              name: {
                type: 'string'
              },
              email: {
                type: 'string'
              },
              password: {
                type: 'string'
              }
            }
          },
          Post: {
            type: "object",
            properties: {
              id: {
                type: "integer"
              },
              title: {
                type: "string"
              },
              content: {
                type: "string"
              },
              author: {
                $ref: "#/components/schemas/User"
              }
            }
          }
        },
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
        
    }
  },
  apis: ['server.js']
};


const swaggerSpec = swaggerJSDoc(options);

module.exports = function (app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
