## Diagnóstico

El login con TMWE (email+password) sí funciona en el lado de TMWE: el usuario aprueba y TMWE redirige al callback con `?code=...&state=...`. El problema está en nuestro callback.

Del session replay:
```
/v2/settings/connections?tmwe=error&reason=TMWE+%2Ferp%2Ftmwe_json%2Fexchange_code_for_jwt+404%3A+
```

`tmwe-oauth-callback` llama a `POST /erp/tmwe_json/exchange_code_for_jwt` y TMWE responde **404**. Ese endpoint no existe en TMWE. El endpoint correcto, ya usado en el resto del proyecto (`tmweClient.ts` líneas 144 y 190 para `client_credentials` y `refresh_token`), es **`/erp/tmwe_json/token`**.

Además dos efectos secundarios visibles del bug actual:
1. El error redirige a `/v2/settings/connections` aunque el `intent` sea `login` — pasa porque el `catch` final llama `back("error", ...)` sin pasar `intent`. Esto explica por qué "vuelve al formulario": realmente acaba en otra ruta de error con query string. (Tu observación de "vuelve a /v2/login" puede estar mezclada con el render del skeleton; igualmente conviene preservar `intent` en el catch.)
2. No tenemos visibilidad de qué endpoint exacto falla porque el log del callback solo muestra "booted". Añadir un `console.error` con el motivo ayuda al debug.

## Cambios

### 1. `supabase/functions/tmwe-oauth-callback/index.ts`
- Cambiar la URL del intercambio code→token de `/erp/tmwe_json/exchange_code_for_jwt` a `/erp/tmwe_json/token`.
- Capturar `intent` antes del `try` (leyéndolo de `state` cuando esté disponible) o, más simple, mover la resolución de `intent` antes y propagarla en el `catch` mediante una variable de cierre, para que los errores devuelvan a `/v2/login` cuando sea login.
- Añadir `console.error("[tmwe-oauth-callback]", reason)` en el catch para que el log del edge function muestre la causa.

### 2. (Opcional) `supabase/functions/_shared/tmweClient.ts`
- Centralizar el path `/erp/tmwe_json/token` en una constante exportada, así la callback y los flows de `client_credentials`/`refresh_token` comparten la misma fuente de verdad. Solo si quieres mantenerlo limpio; no es bloqueante.

## Validación

1. Deploy de `tmwe-oauth-callback`.
2. Click en "Entra con TMWE" → autenticar en TMWE → debería volver con sesión Lovable abierta y aterrizar en `/v2`.
3. Si TMWE responde con otro nombre de campo en `intent=login` (p.e. profile sin `email`), el log del edge function ahora mostrará el motivo exacto.

## Fuera de alcance
- Cambiar el flujo de magic link / auto-provisioning (ya implementado, se valida después del fix del 404).
- Tocar `tmweClient.ts` para refresh/system token (ya apuntan al endpoint correcto).
