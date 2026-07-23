import Foundation
import Combine

/// Coordinator de topo — dono da aba selecionada e de um `Router` independente por aba, para
/// que trocar de aba preserve a pilha de navegação de cada uma (como no `UITabBarController`).
@MainActor
public final class RootCoordinator: ObservableObject {
    @Published public var selectedTab: AppTab = .home

    public let authRouter = Router<AuthRoute>()
    public let homeRouter = Router<HomeRoute>()
    public let diaryRouter = Router<DiaryRoute>()
    public let collectionRouter = Router<CollectionRoute>()
    public let exploreRouter = Router<ExploreRoute>()
    public let playRouter = Router<PlayRoute>()
    public let profileRouter = Router<ProfileRoute>()

    public init() {}

    /// Volta todas as pilhas ao topo — útil ao deslogar, para não deixar telas autenticadas
    /// "penduradas" quando o usuário logar de novo.
    public func resetAllStacks() {
        homeRouter.popToRoot()
        diaryRouter.popToRoot()
        collectionRouter.popToRoot()
        exploreRouter.popToRoot()
        playRouter.popToRoot()
        profileRouter.popToRoot()
        authRouter.popToRoot()
        selectedTab = .home
    }
}
