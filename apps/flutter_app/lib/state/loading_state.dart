/// Per-operation async state tracking.
/// Use per-operation (e.g. playlistImportState), not global isLoading.
enum LoadingState { idle, loading, success, error }
