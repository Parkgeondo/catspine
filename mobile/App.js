import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import CatScene from './src/CatScene';
import { CATS, CAT_BY_ID } from './src/cats';
import { submitScore, fetchLeaderboard } from './src/firebase';

export default function App() {
  const sceneRef = useRef(null);
  const [score, setScore] = useState(0);
  const [mood, setMood] = useState({ text: '고양이를 한 번 돌려보세요!', angry: false });
  const [catId, setCatId] = useState('cheese');

  const [modal, setModal] = useState(false);
  const [nickname, setNickname] = useState('');
  const [board, setBoard] = useState(null); // null=로딩, []=빈, [...]=목록
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState({ text: '', ok: false });
  const [myEntryId, setMyEntryId] = useState(null);

  const handleSpin = useCallback(() => {
    sceneRef.current && sceneRef.current.spin();
  }, []);

  const onScore = useCallback((n) => setScore(n), []);
  const onMood = useCallback((m) => setMood(m), []);

  const openRanking = useCallback(async () => {
    setModal(true);
    setBoard(null);
    try {
      setBoard(await fetchLeaderboard(50));
    } catch (e) {
      setBoard([]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitMsg({ text: '', ok: false });
    const nick = nickname.trim();
    if (nick.length < 2 || nick.length > 12 || /[<>]/.test(nick)) {
      setSubmitMsg({ text: '닉네임은 2~12자로 입력해 주세요.', ok: false });
      return;
    }
    if (score <= 0) {
      setSubmitMsg({ text: '먼저 고양이를 한 번이라도 돌려주세요! 🐱', ok: false });
      return;
    }
    setSubmitting(true);
    try {
      const { entryId, rank } = await submitScore(nick, score, catId);
      setMyEntryId(entryId);
      setSubmitMsg({ text: `등록 완료! 현재 ${rank}위 🎉`, ok: true });
      setBoard(await fetchLeaderboard(50));
    } catch (e) {
      setSubmitMsg({ text: '등록에 실패했어요. 잠시 후 다시 시도해 주세요.', ok: false });
    } finally {
      setSubmitting(false);
    }
  }, [nickname, score, catId]);

  return (
    <SafeAreaView style={styles.root}>
      <ExpoStatusBar style="light" />

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.scoreBox} accessibilityLabel={`현재 점수 ${score}점`}>
          <Text style={styles.scoreLabel}>점수</Text>
          <Text
            style={styles.scoreValue}
            accessibilityLiveRegion="polite"
          >
            {score}
          </Text>
        </View>
        <Pressable
          style={styles.ghostBtn}
          onPress={openRanking}
          accessibilityRole="button"
          accessibilityLabel="랭킹 열기"
        >
          <Text style={styles.ghostBtnText}>🏆 랭킹</Text>
        </Pressable>
      </View>

      {/* 3D 무대 — 탭하면 회전 */}
      <Pressable
        style={styles.stage}
        onPress={handleSpin}
        accessibilityRole="button"
        accessibilityLabel="고양이 돌리기"
      >
        <CatScene ref={sceneRef} catId={catId} onScore={onScore} onMood={onMood} />
      </Pressable>

      {/* 액션 바 */}
      <View style={styles.actionBar}>
        <Text
          style={[styles.mood, mood.angry && styles.moodAngry]}
          accessibilityLiveRegion="polite"
        >
          {mood.text}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.spinBtn, pressed && styles.spinBtnPressed]}
          onPress={handleSpin}
          accessibilityRole="button"
          accessibilityLabel="돌리기"
        >
          <Text style={styles.spinBtnText}>🌀 돌리기</Text>
        </Pressable>
      </View>

      {/* 고양이 선택 */}
      <View style={styles.picker} accessibilityRole="radiogroup">
        {CATS.map((c) => {
          const active = c.id === catId;
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCatId(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${c.name} 고양이`}
            >
              <Text style={styles.chipEmoji}>{c.emoji}</Text>
              <Text style={styles.chipName}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 랭킹 모달 */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>🏆 랭킹</Text>
              <Pressable onPress={() => setModal(false)} accessibilityLabel="닫기" accessibilityRole="button">
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.submitSection}>
              <Text style={styles.submitHint}>
                닉네임은 랭킹 등록 시에만 사용돼요. 안 올려도 게임은 그대로 즐길 수 있어요.
              </Text>
              <View style={styles.submitRow}>
                <TextInput
                  style={styles.input}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="예: 집사123"
                  placeholderTextColor="#7a73a0"
                  maxLength={12}
                  autoCapitalize="none"
                  accessibilityLabel="닉네임 입력 (2~12자)"
                />
                <Pressable
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="내 점수 등록"
                >
                  {submitting ? (
                    <ActivityIndicator color="#2a1c00" />
                  ) : (
                    <Text style={styles.submitBtnText}>등록</Text>
                  )}
                </Pressable>
              </View>
              {submitMsg.text ? (
                <Text style={[styles.submitMsg, submitMsg.ok && styles.submitMsgOk]} accessibilityLiveRegion="polite">
                  {submitMsg.text}
                </Text>
              ) : null}
            </View>

            <ScrollView style={styles.boardScroll}>
              {board === null ? (
                <View style={styles.boardEmpty}>
                  <ActivityIndicator color="#b8b0d8" />
                </View>
              ) : board.length === 0 ? (
                <Text style={styles.boardEmptyText}>아직 랭킹이 없어요. 1등에 도전해 보세요! 🏆</Text>
              ) : (
                board.map((e, i) => {
                  const cat = CAT_BY_ID[e.catId];
                  const medal = ['🥇', '🥈', '🥉'][i] || String(i + 1);
                  const me = myEntryId && e.id === myEntryId;
                  return (
                    <View key={e.id} style={[styles.row, me && styles.rowMe]}>
                      <Text style={styles.rowPos}>{medal}</Text>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {(cat ? cat.emoji + ' ' : '') + e.nickname}
                      </Text>
                      <Text style={styles.rowScore}>{e.score}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#14102a',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    backgroundColor: 'rgba(20,16,40,0.78)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
  },
  scoreLabel: { color: '#b8b0d8', fontSize: 14 },
  scoreValue: { color: '#f4f1ff', fontSize: 32, fontWeight: '800' },
  ghostBtn: {
    backgroundColor: 'rgba(20,16,40,0.78)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ghostBtnText: { color: '#f4f1ff', fontSize: 16, fontWeight: '600' },

  stage: { flex: 1 },

  actionBar: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, gap: 10 },
  mood: { color: '#b8b0d8', fontSize: 16, textAlign: 'center', minHeight: 22 },
  moodAngry: { color: '#ff7a8a', fontWeight: '700' },
  spinBtn: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffb648',
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  spinBtnPressed: { backgroundColor: '#ff9d2e', transform: [{ translateY: 3 }] },
  spinBtnText: { color: '#2a1c00', fontSize: 22, fontWeight: '800' },

  picker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 18,
  },
  chip: {
    width: 78,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(20,16,40,0.78)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 2,
  },
  chipActive: { borderColor: '#ffb648', backgroundColor: 'rgba(255,182,72,0.16)' },
  chipEmoji: { fontSize: 26 },
  chipName: { color: '#f4f1ff', fontSize: 13, fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,6,18,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1d1838',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '86%',
    paddingBottom: 24,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { color: '#f4f1ff', fontSize: 20, fontWeight: '700' },
  closeBtn: { color: '#b8b0d8', fontSize: 22 },

  submitSection: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  submitHint: { color: '#b8b0d8', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  submitRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f4f1ff',
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: '#ffb648',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#2a1c00', fontSize: 15, fontWeight: '700' },
  submitMsg: { marginTop: 8, color: '#ff7a8a', fontSize: 13 },
  submitMsgOk: { color: '#62d28a' },

  boardScroll: { paddingHorizontal: 12, paddingTop: 8 },
  boardEmpty: { padding: 24, alignItems: 'center' },
  boardEmptyText: { color: '#b8b0d8', textAlign: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 10,
  },
  rowMe: { backgroundColor: 'rgba(255,182,72,0.18)', borderWidth: 1, borderColor: '#ffb648' },
  rowPos: { width: 34, textAlign: 'center', color: '#d8d2f0', fontWeight: '800', fontSize: 16 },
  rowName: { flex: 1, color: '#f4f1ff', fontWeight: '600', fontSize: 15 },
  rowScore: { color: '#f4f1ff', fontWeight: '800', fontSize: 16 },
});
