// A successful status read clears transport warnings, never application errors.
export function createNotice(element){
  let waitingForConnection=false;
  function show(text,error=false){
    waitingForConnection=false;
    element.textContent=text;
    element.classList.toggle('error',error);
  }
  return {
    show,
    error(error){
      show(error.message,true);
      waitingForConnection=['REQUEST_TIMEOUT','CONNECTION_ERROR','SERVER_UNAVAILABLE'].includes(error.code);
    },
    connectionRestored(){
      if(waitingForConnection)show('서버 연결이 복구되었습니다. 현재 상태와 iPad 적용 여부를 확인해 주세요.');
    }
  };
}
export function versionNotice(client,server){
  return server&&server!==client?`화면 업데이트가 필요합니다. 현재 PC ${client} / 서버 ${server}. 시행을 마친 뒤 PC와 iPad를 모두 새로고침하고 음원을 다시 선택해 주세요.`:'';
}
