import SwiftUI
import CoordinatorKit

struct HomeFlowView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        RouterNavigationStack(router: root.homeRouter) {
            HomeView()
        } destination: { route in
            switch route {
            case .filmDetail(let target):
                FilmDetailView(target: target)
            case .directorSpotlight(let name):
                Text(name)
            case .onboardingWelcome:
                WelcomeView()
            case .onboardingPickFavorites:
                PickFavoritesView()
            }
        }
    }
}
