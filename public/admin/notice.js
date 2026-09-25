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
      waitingForConnection=['REQUEST_TIMEOUT','CONNECTION_ERROR'].includes(error.code);
    },
    connectionRestored(){
      if(waitingForConnection)show('서버 연결이 복구되었습니다. 현재 상태와 iPad 적용 여부를 확인해 주세요.');
    }
  };
}
