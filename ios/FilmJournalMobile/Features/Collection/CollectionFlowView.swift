import SwiftUI
import CoordinatorKit

struct CollectionFlowView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        RouterNavigationStack(router: root.collectionRouter) {
            CollectionView()
        } destination: { route in
            switch route {
            case .filmDetail(let target):
                FilmDetailView(target: target)
            case .listDetail(let id, let name):
                ListDetailView(listId: id, listName: name)
            }
        }
    }
}
