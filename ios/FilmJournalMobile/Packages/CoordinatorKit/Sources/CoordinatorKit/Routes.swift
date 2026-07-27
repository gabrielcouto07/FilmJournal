import Foundation
import Kit

public enum RootFlow: Equatable, Sendable {
    case loading
    case auth
    case main
}

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

/// `.local` já traz o `Movie` e evita um round-trip; nos outros casos a tela busca o resto.
public enum FilmDetailTarget: Hashable, Sendable {
    case local(Movie)
    case movieId(String)
    case tmdb(Int)

    public var tmdbId: Int? {
        switch self {
        case .local(let movie): return movie.tmdbId
        case .movieId: return nil
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

/// O onboarding não tem `Router` próprio porque a API não expõe se o usuário já passou por ele:
/// é um CTA da Home empurrado na pilha da própria aba.
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
    case lists
    public var id: String { rawValue }
}

public enum CollectionRoute: Hashable, Sendable {
    case filmDetail(FilmDetailTarget)
    case listDetail(id: String, name: String)
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
