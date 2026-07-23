import SwiftUI
import CoordinatorKit

struct ExploreFlowView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        RouterNavigationStack(router: root.exploreRouter) {
            ExploreHomeView()
        } destination: { route in
            switch route {
            case .filmDetail(let target):
                FilmDetailView(target: target)
            case .search:
                SearchView()
            case .discover(let dimension):
                DiscoverView(initialDimension: dimension)
            }
        }
    }
}
