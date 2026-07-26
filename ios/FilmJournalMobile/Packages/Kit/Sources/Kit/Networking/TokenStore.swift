import Foundation
import Security

/// Guarda o par access/refresh token no Keychain (sobrevive a relançamentos do app, igual ao
/// cookie de sessão que a versão anterior usava). O backend atual é stateless (JWT Bearer,
/// "igual para web e ios" — ver `api/src/plugins/jwt.ts`), então não há sessão no servidor:
/// tudo que precisamos persistir localmente são esses dois tokens.
public final class TokenStore {
    public static let shared = TokenStore()

    private let service = "com.filmjournal.mobile.auth"
    private let accessAccount = "accessToken"
    private let refreshAccount = "refreshToken"

    public init() {}

    public var accessToken: String? {
        get { read(account: accessAccount) }
        set {
            if let newValue { write(newValue, account: accessAccount) } else { delete(account: accessAccount) }
        }
    }

    public var refreshToken: String? {
        get { read(account: refreshAccount) }
        set {
            if let newValue { write(newValue, account: refreshAccount) } else { delete(account: refreshAccount) }
        }
    }

    public func store(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }

    public func clear() {
        accessToken = nil
        refreshToken = nil
    }

    // MARK: - Keychain

    private func query(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private func read(account: String) -> String? {
        var query = query(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func write(_ value: String, account: String) {
        let data = Data(value.utf8)
        var query = query(account: account)

        if SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess {
            SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        } else {
            query[kSecValueData as String] = data
            query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(query as CFDictionary, nil)
        }
    }

    private func delete(account: String) {
        SecItemDelete(query(account: account) as CFDictionary)
    }
}
