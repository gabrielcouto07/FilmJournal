import SwiftUI
import UniformTypeIdentifiers
import Kit
import DesignKit

struct ImportLetterboxdView: View {
    @Environment(\.filmJournalAPI) private var api
    @StateObject private var viewModel = ImportLetterboxdViewModel()
    @State private var isPickingFile = false

    var body: some View {
        FJScreen("Importar") {
        Form {
            Section {
                Text("Selecione o arquivo .zip exportado do Letterboxd (Settings → Import & Export → Export Data) para importar seu histórico de filmes.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section {
                Button {
                    isPickingFile = true
                } label: {
                    HStack {
                        Text("Escolher arquivo .zip")
                        if viewModel.isImporting {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.isImporting)
            }

            if let result = viewModel.result {
                Section(result.ok ? "Importação concluída" : "Falha na importação") {
                    if let summary = result.summary {
                        Text("\(String(describing: summary))")
                            .font(.footnote)
                    }
                    if let errors = result.errors {
                        Text("\(String(describing: errors))")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
            }
        }
        }
        .fileImporter(isPresented: $isPickingFile, allowedContentTypes: [.zip]) { result in
            switch result {
            case .success(let url):
                Task { await viewModel.importFile(from: url, api: api) }
            case .failure(let error):
                viewModel.errorMessage = error.localizedDescription
            }
        }
    }
}
