import SwiftUI
import CoordinatorKit

/// Barra de abas principal — cada aba tem seu próprio `Router` (ver `RootCoordinator`), então
/// trocar de aba preserva a navegação da aba anterior.
///
/// Só 4 abas de propósito (Paladar, Diário, Coleção, Perfil) — o iOS agrupa automaticamente
/// abas além da 4ª numa aba "Mais" (um `UINavigationController` extra do sistema), o que
/// aninhava dois `NavigationStack` para Jogar/Perfil (5ª e 6ª aba) e duplicava o botão de
/// voltar. Explorar e Jogar continuam existindo — acessíveis via botão em `HomeView`,
/// apresentados como sheet — sem entrar nesse limite.
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
