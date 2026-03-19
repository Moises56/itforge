# ITForge — Cheat Sheet de Prompts Eficientes para Claude Code

## Prompts Cortos que Ahorran Tokens

### Cuando quieras que siga un patrón existente:
```
Crea src/modules/development/actions/update-project.ts
siguiendo exactamente el patrón de create-project.ts
```

### Cuando necesites un componente similar a otro:
```
Crea ProjectCredentialList basándote en ProjectDocumentList
pero para credenciales con botón Reveal
```

### Para fixes rápidos:
```
El build falla con error [pegar error]. Corrígelo.
```

### Para agregar un campo al schema:
```
Agrega campo 'notes' (String, opcional) a la tabla Project.
Haz push a la DB y actualiza los tipos.
```

### Para pedir código sin explicación:
```
Implementa [X]. Solo código, sin explicaciones.
Agrega comentarios en el código donde haya decisiones importantes.
```

### Para refactoring:
```
Refactoriza [archivo] extrayendo [lógica] a un módulo separado.
Mantén la misma funcionalidad. Ejecuta typecheck después.
```

## Frases de Control Útiles

| Quiero...                        | Dile a Claude Code...                          |
|----------------------------------|------------------------------------------------|
| Solo planificar, sin código      | "Solo planifica, no implementes todavía"       |
| Implementar un plan ya aprobado  | "Ejecuta el plan anterior"                     |
| Que no toque ciertos archivos    | "No modifiques [archivo]. Solo crea nuevos."   |
| Que haga commit                  | "Haz commit con mensaje: feat(x): descripción" |
| Que ejecute tests/build          | "Ejecuta pnpm typecheck y corrige errores"     |
| Que use una skill                | "Usa la skill frontend-design para esto"       |
| Limpiar contexto                 | /clear                                         |
| Ver estado del contexto          | /context                                       |

## Anti-Patterns (NO hagas esto)

❌ "Crea todo el módulo de proyectos con CRUD, permisos, uploads, y credenciales"
   → Demasiado amplio, va a consumir todo el contexto y el resultado será mediocre

❌ "Explícame cómo funciona el pattern de Server Actions en Next.js"
   → No uses Claude Code para aprender. Usa Claude.ai para eso. Claude Code es para HACER.

❌ Copiar y pegar código existente en el prompt para "darle contexto"
   → Claude Code ya puede leer los archivos. Di: "Lee src/core/auth/session.ts"

❌ Pedir cambios en 10 archivos en un solo prompt
   → Divide: 3-4 archivos máximo por prompt para mantener calidad.

✅ "Lee CLAUDE.md. Crea el componente ProjectCard en src/components/shared/
   que muestre: nombre, estado (badge), nivel de control (indicador color),
   link directo, y stack principal. Usa shadcn/ui Card. Usa la skill frontend-design."
