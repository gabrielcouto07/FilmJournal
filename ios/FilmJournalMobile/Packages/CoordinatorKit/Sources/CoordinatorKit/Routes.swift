import Foundation
import Kit

/// Estado geral da raiz do app — decide qual "mundo" mostrar (ver `RootCoordinator`).
public enum RootFlow: Equatable, Sendable {
    case loading
    case auth
    case main
}

/// Abas principais do app — espelham a navegação de topo do FilmJournal web
/// (`/`, `/diary`, `/collection`, `/search`+`/discover`, `/play`, `/profile`).
public enum AppTab: String, CaseIterable, Identifiable, Sendable {
    case home
    case diary
    case collection
    case explore
    case play
    case profile

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .home: return "Paladar"
        case .diary: return "Diário"
        case .collection: return "Coleção"
        case .explore: return "Explorar"
        case .play: return "Jogar"
        case .profile: return "Perfil"
        }
    }

    public var systemImage: String {
        switch self {
        case .home: return "chart.pie"
        case .diary: return "book.closed"
        case .collection: return "star"
        case .explore: return "sparkle.magnifyingglass"
        case .play: return "gamecontroller"
        case .profile: return "person.circle"
        }
    }
}

/// Referência a um filme para abrir a ficha de detalhe.
///
/// `.local` carrega o `Movie` já mesclado com o estado do usuário (evita um round-trip: a
/// maioria das telas navega a partir de uma lista que já buscou o filme). `.tmdb` é usado
/// quando só temos o `tmdbId` (ex. resultado de busca/feed do TMDB, ainda fora do catálogo) —
/// a tela de detalhe busca os dados via `TMDBService.details(tmdbId:)` e, se o usuário agir
/// sobre o filme (favoritar, avaliar...), ele entra no catálogo local naquele momento.
public enum FilmDetailTarget: Hashable, Sendable {
    case local(Movie)
    case tmdb(Int)

    public var tmdbId: Int? {
        switch self {
        case .local(let movie): return movie.tmdbId
        case .tmdb(let id): return id
        }
    }
}

// MARK: - Auth

public enum AuthRoute: Hashable, Sendable {
    case login
    case register
}

// MARK: - Home ("Paladar")

/// Onboarding não é um fluxo separado com `Router` próprio: a API não expõe se o usuário já
/// passou por ele (`AppSettings` não inclui `onboardedAt`), então ele é oferecido como uma ação
/// explícita a partir da Home (ex. CTA "Complete seu Paladar") e empurrado na própria pilha
/// da aba — por isso os dois passos (`onboardingWelcome`/`onboardingPickFavorites`) vivem aqui.
public enum HomeRoute: Hashable, Sendable {
    case filmDetail(FilmDetailTarget)
    case directorSpotlight(name: String)
    case onboardingWelcome
    case onboardingPickFavorites
}

// MARK: - Diário

public enum DiaryRoute: Hashable, Sendable {
    case filmDetail(FilmDetailTarget)
}

// MARK: - Coleção (Favoritos / Top 10 / Watchlist)

public enum CollectionTab: String, CaseIterable, Identifiable, Sendable {
    case favorites
    case top10
    case watchlist
    public var id: String { rawValue }
}

public enum CollectionRoute: Hashable, Sendable {
    case filmDetail(FilmDetailTarget)
}

// MARK: - Busca + Descobrir (agrupados na aba "Explorar")

public enum ExploreRoute: Hashable, Sendable {
    case filmDetail(FilmDetailTarget)
    case search
    case discover(GapDimension?)
}

// MARK: - Play (Jogo + Roleta)

public enum PlayTab: String, CaseIterable, Identifiable, Sendable {
    case game
    case roulette
    public var id: String { rawValue }
}

public enum PlayRoute: Hashable, Sendable {
    case filmDetail(FilmDetailTarget)
    case activeRound
}

// MARK: - Perfil

public enum ProfileRoute: Hashable, Sendable {
    case editProfile
    case changeEmail
    case changePassword
    case appSettings
    case importLetterboxd
    case deleteAccount
}
