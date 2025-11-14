// game.js : 매칭 / 라운드 / 룰렛 / 결과 표시 담당

// 닉네임 설정
btnNick?.addEventListener('click', () => {
  const nick = nickInput.value.trim();
  socket.emit('set_nick', nick);
  statusEl.textContent = '닉네임 설정 완료.';
});

// 매칭 시작
btnQueue?.addEventListener('click', () => {
  // 결과 영역 초기화
  resultEl.classList.add('hidden');
  resultEl.textContent = '';

  mePick.textContent  = '?';
  oppPick.textContent = '?';

  // 배지 초기화
  if (meBadge) {
    meBadge.classList.add('hidden');
    meBadge.src = '';
  }
  if (oppBadge) {
    oppBadge.classList.add('hidden');
    oppBadge.src = '';
  }

  statusEl.textContent = '매칭 대기 중...';
  socket.emit('join_queue');
});

// === 매칭 관련 소켓 이벤트 ===

// 대기열 진입
socket.on('queue:joined', () => {
  statusEl.textContent = '대기열에 들어갔습니다. 상대를 기다리는 중...';
});

// 매칭 완료
socket.on('match:ready', ({ roomId, players }) => {
  statusEl.textContent = `매칭 완료! 방: ${roomId}`;
  battle.classList.remove('hidden');

  // 나 / 상대 구분
  const me  = players.find(p => p.id === socket.id);
  const opp = players.find(p => p.id !== socket.id);

  meName.textContent  = me?.nick  || 'Me';
  oppName.textContent = opp?.nick || 'Opponent';
});

// 룰렛 안내 (몇 판 중에 터질지 모른다는 설명)
socket.on('roulette:plan', ({ total }) => {
  roulPanel.classList.remove('hidden');
  roulInfo.textContent = `러시안 룰렛 준비 완료 (총 ${total}판 중 어딘가에서 터진다)`;
});

// === 라운드 진행 ===
let roundTimerId = null;

socket.on('round:start', ({ round, deadline }) => {
  resultEl.classList.add('hidden');
  mePick.textContent  = '?';
  oppPick.textContent = '?';
  battle.classList.remove('hidden');

  const endAt = deadline || (Date.now() + 7000);

  const tick = () => {
    const remainMs = Math.max(0, endAt - Date.now());
    const sec = Math.ceil(remainMs / 1000);
    statusEl.textContent = `Round ${round} — ${sec}초 내에 선택하세요`;
    if (remainMs <= 0) {
      clearInterval(roundTimerId);
      roundTimerId = null;
    }
  };

  clearInterval(roundTimerId);
  tick();
  roundTimerId = setInterval(tick, 100);
});

// 내가 손 선택
$$('.controls button').forEach(btn => {
  btn.addEventListener('click', () => {
    const hand = btn.dataset.hand;
    if (!hand) return;

    mePick.textContent = toKorean(hand);
    statusEl.textContent = '선택 완료. 상대를 기다리는 중...';
    socket.emit('pick', hand);
  });
});

// 상대가 선택했을 때
socket.on('opponent:picked', () => {
  oppPick.textContent = '선택 완료';
});

// 라운드 결과 공개
socket.on('match:reveal', ({ picks, winner, round }) => {
  const myPick   = toKorean(picks[socket.id]);
  const oppId    = Object.keys(picks).find(id => id !== socket.id);
  const oppPickK = toKorean(picks[oppId]);

  mePick.textContent  = myPick;
  oppPick.textContent = oppPickK;

  resultEl.classList.remove('hidden');

  if (!winner) {
    resultEl.textContent = `라운드 ${round} 결과: 무승부`;
  } else if (winner === socket.id) {
    resultEl.textContent = `라운드 ${round} 결과: 승리! 🏆`;
  } else {
    resultEl.textContent = `라운드 ${round} 결과: 패배...`;
  }
});

// 최종 BANG!
socket.on('roulette:bang', ({ round, bulletRound, winner, loser }) => {
  const iAmWinner = (winner === socket.id);

  resultEl.classList.remove('hidden');
  resultEl.textContent = `💥 BANG! (총알 라운드: ${bulletRound}) — 라운드 ${round}에서 최종 결정`;

  statusEl.textContent = iAmWinner ? '최종 승리! 🎉' : '최종 패배...';

  // 오버레이 + GIF
  const overlay = document.getElementById('resultOverlay');
  const gif     = document.getElementById('resultGif');
  const closeBtn = document.getElementById('closeOverlay');

  if (gif) gif.src = iAmWinner ? '/win.gif' : '/lose.gif';
  if (overlay) overlay.classList.add('show');

  // 나가기 버튼 동작
  if (closeBtn) {
    closeBtn.onclick = () => {
      overlay.classList.remove('show');

      // 화면 초기화
      battle.classList.add('hidden');
      resultEl.classList.add('hidden');
      roulPanel.classList.add('hidden');

      statusEl.textContent = '대기 중...';
      mePick.textContent   = '?';
      oppPick.textContent  = '?';
      meBadge?.classList.add('hidden');
      oppBadge?.classList.add('hidden');

      socket.emit('leave_game'); // 서버에 방 나가기 알림
      // 클라이언트 측 socket.data는 굳이 건들 필요 없음
    };
  }
});

// 경기 강제 종료
socket.on('match:end', ({ score, winner }) => {
  resultEl.classList.remove('hidden');
  resultEl.textContent = '경기 종료';
  statusEl.textContent = '게임 종료';
});

// 상대가 나간 경우
socket.on('match:abort', () => {
  statusEl.textContent = '상대가 나갔습니다. 게임이 중단되었습니다.';
  battle.classList.add('hidden');
});

// 시스템 메시지 (위쪽 상태창에만 표시)
socket.on('system:info', (msg) => {
  statusEl.textContent = msg;
});
