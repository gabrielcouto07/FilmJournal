import SwiftUI
import CoordinatorKit

// No máximo 4 abas: o iOS joga da 5ª em diante numa aba "Mais", que aninha um
// `UINavigationController` extra e duplica o botão de voltar. Explorar e Jogar viram sheet na Home.
struct MainTabView: View {
    @EnvironmentObject private var root: RootCoordinator

    var body: some View {
        TabView(selection: $root.selectedTab) {
            HomeFlowView()
                .tabItem { Label(AppTab.home.title, systemImage: AppTab.home.systemImage) }
                .tag(AppTab.home)

            DiaryFlowView()
                .tabItem { Label(AppTab.diary.title, systemImage: AppTab.diary.systemImage) }
                .tag(AppTab.diary)

            CollectionFlowView()
                .tabItem { Label(AppTab.collection.title, systemImage: AppTab.collection.systemImage) }
                .tag(AppTab.collection)

            ProfileFlowView()
                .tabItem { Label(AppTab.profile.title, systemImage: AppTab.profile.systemImage) }
                .tag(AppTab.profile)
        }
    }
}
