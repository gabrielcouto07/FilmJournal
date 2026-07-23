# FilmJournal — iOS (SwiftUI)

App nativo iOS para o [FilmJournal](../FilmJournal) (diário de filmes em Next.js). Consome a
mesma API REST do backend web — não há lógica de negócio duplicada no cliente.

## Arquitetura

Um único diretório de código-fonte na raiz (`FilmJournalMobile/`), com 3 pacotes Swift
locais (SPM) consumidos pelo target do app:

```
FilmJournalMobile/                 (repo)
├── FilmJournalMobile.xcodeproj    ← gerado pelo XcodeGen a partir de project.yml
├── project.yml                    ← única fonte de verdade da configuração do projeto
└── FilmJournalMobile/             ← todo o código-fonte mora aqui
    ├── App/                       ← entry point, DI (@Environment), RootView, TabView
    ├── Features/                  ← uma pasta por feature (View + ViewModel + FlowView)
    ├── Resources/
    │   └── Assets.xcassets
    ├── Info.plist
    └── Packages/                  ← pacotes Swift locais (SPM)
        ├── Kit/                   ← networking, models, services — TODAS as chamadas de API
        ├── CoordinatorKit/        ← navegação (Router<Route>, RootCoordinator)
        └── DesignKit/             ← tokens de design + componentes estruturais mínimos
```

- **Kit**: client HTTP (`APIClient`), modelos `Codable` espelhando o schema/respostas do
  backend, e um service por área da API (`MoviesService`, `LogsService`, `PlayService`,
  `RouletteService`, `DiscoverService`, `RecommendationsService`, `SettingsService`, etc.) —
  todos agrupados em `FilmJournalAPI`. `SessionController` guarda o usuário logado.
- **CoordinatorKit**: um `Router<Route>` genérico por aba (`RootCoordinator.homeRouter`,
  `.diaryRouter`, ...) + `RouterNavigationStack` (liga um `Router` a uma `NavigationStack`).
- **DesignKit**: paleta de cores (`Color.fjAccent`, `.fjCanvas`, `.fjSurface1/2/3`, `.fjText`...)
  espelhando `src/app/globals.css` do web, `Spacing`/`CornerRadius`, e componentes estruturais
  mínimos (`RemotePosterImage`, `RatingStarsView`, `LoadingStateView`/`EmptyStateView`/`ErrorStateView`).

Cada feature em `Features/` segue o mesmo padrão:
- `XView.swift` — a tela (SwiftUI).
- `XViewModel.swift` — `@MainActor final class: ObservableObject`, recebe `FilmJournalAPI` (ou
  um service específico) como **parâmetro dos métodos**, nunca guardado no `init()`.
- `XFlowView.swift` — `NavigationStack` da aba, via `RouterNavigationStack`.

A tela de detalhe do filme (`Features/FilmDetail`) é compartilhada por todas as abas.

## Setup

Requer Xcode 16+, [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).

```bash
xcodegen generate       # gera FilmJournalMobile.xcodeproj a partir de project.yml
open FilmJournalMobile.xcodeproj
```

Sempre que adicionar/remover arquivos `.swift`, rode `xcodegen generate` de novo (o projeto é
gerado, não deve ser editado manualmente no Xcode além de rodar/depurar).

### Apontando para o backend

`FilmJournalMobileApp.swift` cria um `FilmJournalAPI(config: .localhost)`. As opções prontas
(`Packages/Kit/Sources/Kit/Environment/AppConfig.swift`):

| Config | Uso |
|---|---|
| `.localhost` | Simulator + backend `npm run dev` na mesma máquina (`http://localhost:3000`) |
| `.lan(host:)` | Device físico + backend na mesma rede (`http://SEU_IP:3000`) |
| `.production(host:)` | Backend hospedado, HTTPS |

O `Info.plist` já libera tráfego HTTP local (`NSAppTransportSecurity.NSAllowsLocalNetworking`)
para as duas primeiras opções — produção deve sempre usar HTTPS.

### Autenticação

O backend usa NextAuth.js (sessão JWT em cookie httpOnly) e **não expõe uma rota de login em
JSON** — o app reproduz a mesma dança que o client web do NextAuth faz (`AuthService.swift`):
`GET /api/auth/csrf` → `POST /api/auth/callback/credentials` → `GET /api/auth/session`. A
`URLSession` usa `HTTPCookieStorage.shared`, que o iOS persiste entre aberturas do app — não é
necessário implementar refresh de token manualmente.

## Rodando

1. Suba o backend: `cd ../FilmJournal && npm run dev`.
2. No Xcode, selecione o scheme `FilmJournalMobile` e um simulador, ▶️.
3. Crie uma conta pela tela "Criar conta" (usa `POST /api/auth/register`).

## Limitações conhecidas (por desenho da API atual, não bugs)

- **Onboarding não é um gate automático**: a API não expõe se o usuário já passou pelo
  onboarding (`AppSettings` não tem `onboardedAt`). Por isso ele aparece como um CTA opcional
  na Home ("Complete seu Paladar", visível quando `ratedFilms < 5`), não como tela forçada.
- **Sem filtro server-side para Favoritos/Top 10**: `GET /api/movies` só filtra por
  `watchlist` no servidor. As abas Favoritos/Top 10 buscam sem filtro e filtram no cliente.
- **Sem endpoint "buscar filme local por id"**: a ficha do filme, quando só tem o `tmdbId`,
  resolve o registro local buscando por título em `GET /api/movies?q=`. Funciona bem para
  acervos pessoais, mas não é um lookup exato por id.
- **Import do Letterboxd**: `summary`/`errors` da resposta são JSON livre (a API não documenta
  uma forma fixa) — hoje exibidos como texto bruto.

## Próximos passos sugeridos

- Refinar visualmente cada tela usando os tokens de `DesignKit` (`Color.fjCanvas`,
  `.fjSurface1/2/3`, `.fjText`, `.fjTextSoft`, `CornerRadius.*`) nos fundos/cards de cada `List`/
  `Form` — hoje só os componentes compartilhados (posters, estados de loading/erro, estrelas)
  e o tint global usam a paleta; o layout fino de cada tela ainda é o padrão do sistema.
- Ler `AppSettings.theme`/`accentColor` reais do usuário (`SettingsService`) e aplicar via
  `.preferredColorScheme`/`.tint` dinamicamente, em vez do `.dark`/`.fjAccent` fixos hoje em
  `FilmJournalMobileApp.swift`.
- Ícone do app e launch screen (hoje sem `AppIcon`).
