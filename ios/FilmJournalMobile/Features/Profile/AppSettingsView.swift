import SwiftUI
import Kit
import DesignKit

struct AppSettingsView: View {
    @Environment(\.filmJournalAPI) private var api
    @StateObject private var viewModel = AppSettingsViewModel()

    @State private var region = ""
    @State private var accentColor = ""

    var body: some View {
        FJScreen("Preferências") {
            Group {
                if viewModel.isLoading {
                    LoadingStateView(message: "Carregando preferências…")
                } else {
                    form
                }
            }
        }
        .task {
            await viewModel.load(api: api)
            region = viewModel.settings.region
            accentColor = viewModel.settings.accentColor
        }
    }

    private var form: some View {
        Form {
            Section("Aparência") {
                Picker("Tema", selection: Binding(
                    get: { viewModel.settings.theme },
                    set: { newValue in Task { await viewModel.setTheme(newValue, api: api) } }
                )) {
                    Text("Sistema").tag(AppTheme.system)
                    Text("Escuro").tag(AppTheme.dark)
                    Text("Claro").tag(AppTheme.light)
                }

                HStack {
                    TextField("Cor de destaque (#RRGGBB)", text: $accentColor)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit {
                            Task { await viewModel.setAccentColor(accentColor, api: api) }
                        }
                }
            }

            Section("Idioma e região") {
                Picker("Idioma", selection: Binding(
                    get: { viewModel.settings.language },
                    set: { newValue in Task { await viewModel.setLanguage(newValue, api: api) } }
                )) {
                    Text("Português (BR)").tag(AppLanguage.ptBR)
                    Text("English").tag(AppLanguage.en)
                }

                TextField("Região (ex.: BR)", text: $region)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .onSubmit {
                        Task { await viewModel.setRegion(region, api: api) }
                    }

                Picker("Formato de data", selection: Binding(
                    get: { viewModel.settings.dateFormat },
                    set: { newValue in Task { await viewModel.setDateFormat(newValue, api: api) } }
                )) {
                    Text("dd/MM/yyyy").tag(DateFormatPreference.ddMMyyyy)
                    Text("MM/dd/yyyy").tag(DateFormatPreference.MMddyyyy)
                    Text("yyyy-MM-dd").tag(DateFormatPreference.yyyyMMdd)
                }
            }

            Section("Avaliações") {
                Picker("Escala de nota", selection: Binding(
                    get: { viewModel.settings.defaultRatingScale },
                    set: { newValue in Task { await viewModel.setDefaultRatingScale(newValue, api: api) } }
                )) {
                    Text("5 estrelas").tag(5)
                    Text("10 estrelas").tag(10)
                }

                Toggle("Permitir meia-estrela", isOn: Binding(
                    get: { viewModel.settings.allowHalfStars },
                    set: { newValue in Task { await viewModel.setAllowHalfStars(newValue, api: api) } }
                ))
            }

            Section("Privacidade e notificações") {
                Toggle("Mostrar conteúdo adulto", isOn: Binding(
                    get: { viewModel.settings.showAdultContent },
                    set: { newValue in Task { await viewModel.setShowAdultContent(newValue, api: api) } }
                ))

                Toggle("Notificações por e-mail", isOn: Binding(
                    get: { viewModel.settings.emailNotifications },
                    set: { newValue in Task { await viewModel.setEmailNotifications(newValue, api: api) } }
                ))
            }

            if viewModel.isSaving {
                Section {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                }
            }

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }
            }
        }
    }
}
