import Foundation
import Combine

/// Coordinator de topo: um `Router` independente por aba, para que trocar de aba preserve a
/// pilha de navegação de cada uma.
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

    /// Chamar ao deslogar, senão telas autenticadas ficam penduradas no próximo login.
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
