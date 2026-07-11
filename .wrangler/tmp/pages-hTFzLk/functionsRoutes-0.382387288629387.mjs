import { onRequest as __api_cron_update_js_onRequest } from "C:\\Users\\ASUS\\.gemini\\antigravity-ide\\scratch\\kalenderku\\functions\\api\\cron-update.js"
import { onRequest as __api_holidays_js_onRequest } from "C:\\Users\\ASUS\\.gemini\\antigravity-ide\\scratch\\kalenderku\\functions\\api\\holidays.js"

export const routes = [
    {
      routePath: "/api/cron-update",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_cron_update_js_onRequest],
    },
  {
      routePath: "/api/holidays",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_holidays_js_onRequest],
    },
  ]