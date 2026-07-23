import SwiftUI
import CoordinatorKit

struct PlayFlowView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        RouterNavigationStack(router: root.playRouter) {
            PlayHomeView()
        } destination: { route in
            switch route {
            case .filmDetail(let target):
                FilmDetailView(target: target)
            case .activeRound:
                GameView()
            }
        }
    }
}
