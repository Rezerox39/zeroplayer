use super::RepeatMode;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn add_to_queue(
    state: State<'_, AppState>,
    track: crate::library::Track,
) -> Result<(), String> {
    let mut queue = state.queue.write().await;
    queue.queue.add(track);
    Ok(())
}

#[tauri::command]
pub async fn remove_from_queue(
    state: State<'_, AppState>,
    index: usize,
) -> Result<(), String> {
    let mut queue = state.queue.write().await;
    queue.queue.remove(index);
    Ok(())
}

#[tauri::command]
pub async fn reorder_queue(
    state: State<'_, AppState>,
    from: usize,
    to: usize,
) -> Result<(), String> {
    let mut queue = state.queue.write().await;
    queue.queue.reorder(from, to);
    Ok(())
}

#[tauri::command]
pub async fn clear_queue(state: State<'_, AppState>) -> Result<(), String> {
    let mut queue = state.queue.write().await;
    queue.queue.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_queue(state: State<'_, AppState>) -> Result<Vec<crate::library::Track>, String> {
    let queue = state.queue.read().await;
    Ok(queue.queue.tracks.clone())
}

#[tauri::command]
pub async fn next_track(state: State<'_, AppState>) -> Result<Option<crate::library::Track>, String> {
    let mut queue = state.queue.write().await;
    Ok(queue.queue.next())
}

#[tauri::command]
pub async fn previous_track(state: State<'_, AppState>) -> Result<Option<crate::library::Track>, String> {
    let mut queue = state.queue.write().await;
    Ok(queue.queue.previous())
}

#[tauri::command]
pub async fn set_repeat_mode(state: State<'_, AppState>, mode: RepeatMode) -> Result<(), String> {
    let mut queue = state.queue.write().await;
    queue.queue.repeat = mode;
    Ok(())
}

#[tauri::command]
pub async fn toggle_shuffle(state: State<'_, AppState>) -> Result<bool, String> {
    let mut queue = state.queue.write().await;
    Ok(queue.queue.shuffle_toggle())
}
