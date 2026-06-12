; DoZii NSIS-Erweiterung: Beim Deinstallieren fragen, ob Nutzerdaten
; (Dokumente, Analysen, Chats, Einstellungen, Logs) mitgeloescht werden.
; Bewusst Opt-in per Nachfrage statt deleteAppDataOnUninstall (das loescht immer).
; Strings ASCII-only, um NSIS-Encoding-Probleme zu vermeiden.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Sollen auch alle DoZii-Nutzerdaten geloescht werden?$\r$\n$\r$\nDas umfasst importierte Dokumente, Analysen, Chats, Einstellungen und Logs:$\r$\n$APPDATA\DoZii" \
      /SD IDNO IDNO KeepUserData
      RMDir /r "$APPDATA\DoZii"
    KeepUserData:
  ${endIf}
!macroend
