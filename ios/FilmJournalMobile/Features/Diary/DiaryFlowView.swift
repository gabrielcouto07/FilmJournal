import SwiftUI
import CoordinatorKit

struct DiaryFlowView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        RouterNavigationStack(router: root.diaryRouter) {
            DiaryView()
        } destination: { route in
            switch route {
            case .filmDetail(let target):
                FilmDetailView(target: target)
            }
        }
    }
}
