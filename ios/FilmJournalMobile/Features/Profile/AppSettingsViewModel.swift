import Foundation
import Kit

@MainActor
final class AppSettingsViewModel: ObservableObject {
    @Published private(set) var settings: AppSettings = .default
    @Published private(set) var isLoading = false
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    func load(api: FilmJournalAPI) async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            settings = try await api.settings.get()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setTheme(_ theme: AppTheme, api: FilmJournalAPI) async {
        settings.theme = theme
        await save(SettingsUpdateRequest(theme: theme), api: api)
    }

    func setLanguage(_ language: AppLanguage, api: FilmJournalAPI) async {
        settings.language = language
        await save(SettingsUpdateRequest(language: language), api: api)
    }

    func setDateFormat(_ dateFormat: DateFormatPreference, api: FilmJournalAPI) async {
        settings.dateFormat = dateFormat
        await save(SettingsUpdateRequest(dateFormat: dateFormat), api: api)
    }

    func setDefaultRatingScale(_ scale: Int, api: FilmJournalAPI) async {
        settings.defaultRatingScale = scale
        await save(SettingsUpdateRequest(defaultRatingScale: scale), api: api)
    }

    func setAllowHalfStars(_ value: Bool, api: FilmJournalAPI) async {
        settings.allowHalfStars = value
        await save(SettingsUpdateRequest(allowHalfStars: value), api: api)
    }

    func setShowAdultContent(_ value: Bool, api: FilmJournalAPI) async {
        settings.showAdultContent = value
        await save(SettingsUpdateRequest(showAdultContent: value), api: api)
    }

    func setEmailNotifications(_ value: Bool, api: FilmJournalAPI) async {
        settings.emailNotifications = value
        await save(SettingsUpdateRequest(emailNotifications: value), api: api)
    }

    func setRegion(_ region: String, api: FilmJournalAPI) async {
        settings.region = region
        await save(SettingsUpdateRequest(region: region), api: api)
    }

    func setAccentColor(_ hex: String, api: FilmJournalAPI) async {
        settings.accentColor = hex
        await save(SettingsUpdateRequest(accentColor: hex), api: api)
    }

    private func save(_ request: SettingsUpdateRequest, api: FilmJournalAPI) async {
        isSaving = true
        defer { isSaving = false }
        errorMessage = nil
        do {
            settings = try await api.settings.update(request)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
