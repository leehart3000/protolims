// Starts Swagger UI on the API's documentation page (/api/docs), from the site's own copy in
// public/swagger-ui (see scripts/copy-swagger-ui.mjs). This file sits beside that folder, which
// isn't kept in git. A file of its own, rather than inline in the page, so the security policy
// can allow only the site's own script files.
window.ui = window.SwaggerUIBundle({
  url: '/api/openapi.json',
  dom_id: '#swagger-ui',
  layout: 'BaseLayout',
  deepLinking: true,
  showExtensions: true,
  showCommonExtensions: true,
  presets: [window.SwaggerUIBundle.presets.apis, window.SwaggerUIBundle.SwaggerUIStandalonePreset],
  // Don't ask swagger.io to check the API's description (a request to another site).
  validatorUrl: null,
})
