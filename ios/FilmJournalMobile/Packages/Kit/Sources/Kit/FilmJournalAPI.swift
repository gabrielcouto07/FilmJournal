import Foundation

/// Ponto único de acesso a todos os services — injete uma instância no app (via
/// `@Environment`/DI) e alcance qualquer rota da API do FilmJournal a partir dela.
public final class FilmJournalAPI {
    public let client: APIClient

    public let auth: AuthService
    public let account: AccountService
    public let profile: ProfileService
    public let movies: MoviesService
    public let logs: LogsService
    public let tmdb: TMDBService
    public let settings: SettingsService
    public let discover: DiscoverService
    public let roulette: RouletteService
    public let play: PlayService
    public let recommendations: RecommendationsService
    public let onboarding: OnboardingService
    public let importer: ImportService

    public init(config: AppConfig) {
        let client = APIClient(config: config)
        self.client = client
        self.auth = AuthService(client: client)
        self.account = AccountService(client: client)
        self.profile = ProfileService(client: client)
        self.movies = MoviesService(client: client)
        self.logs = LogsService(client: client)
        self.tmdb = TMDBService(client: client)
        self.settings = SettingsService(client: client)
        self.discover = DiscoverService(client: client)
        self.roulette = RouletteService(client: client)
        self.play = PlayService(client: client)
        self.recommendations = RecommendationsService(client: client)
        self.onboarding = OnboardingService(client: client)
        self.importer = ImportService(client: client)
    }
}
