import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { theme } from '../theme';
import { NICK_RE, CAT_BY_ID } from '../cats';
import {
  submitScore,
  getLeaderboard,
  isLocalMode,
} from '../ranking/ranking';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankingModal({ visible, onClose, score, catId, onSubmitted }) {
  const [nickname, setNickname] = useState('');
  const [entries, setEntries] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const [myEntryId, setMyEntryId] = useState(null);

  async function refresh() {
    setEntries(null);
    try {
      setEntries(await getLeaderboard(50));
    } catch {
      setEntries([]);
    }
  }

  useEffect(() => {
    if (visible) refresh();
  }, [visible]);

  async function onSubmit() {
    setMsg({ text: '', ok: false });
    const nick = nickname.trim();
    if (!NICK_RE.test(nick)) {
      setMsg({ text: '닉네임은 2~12자, 한글/영문/숫자만 사용할 수 있어요.', ok: false });
      return;
    }
    if (score <= 0) {
      setMsg({ text: '먼저 고양이를 한 번이라도 돌려주세요! 🐱', ok: false });
      return;
    }
    setBusy(true);
    try {
      const result = await submitScore({ nickname: nick, score, catId });
      setMyEntryId(result.entryId);
      onSubmitted?.(result.entryId);
      setMsg({
        text: result.local
          ? `등록 완료! 현재 ${result.rank}위 🎉 (이 기기 기록)`
          : `등록 완료! 현재 ${result.rank}위 🎉`,
        ok: true,
      });
      await refresh();
    } catch (err) {
      setMsg({ text: err.userMessage || '등록에 실패했어요. 다시 시도해 주세요.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>🏆 랭킹</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            닉네임은 <Text style={styles.bold}>랭킹 등록 시에만</Text> 사용돼요.
            {isLocalMode()
              ? ' 온라인 서버가 없어 이 기기에만 저장됩니다.'
              : ' 안 올려도 게임은 그대로 즐길 수 있어요.'}
          </Text>

          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="예: 집사123"
              placeholderTextColor={theme.textDim}
              maxLength={12}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
            <Pressable
              style={[styles.submitBtn, busy && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={busy}
            >
              <Text style={styles.submitBtnText}>내 점수 등록</Text>
            </Pressable>
          </View>

          {msg.text ? (
            <Text style={[styles.msg, msg.ok ? styles.msgOk : styles.msgErr]}>{msg.text}</Text>
          ) : null}

          <View style={styles.listWrap}>
            {entries === null ? (
              <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
            ) : entries.length === 0 ? (
              <Text style={styles.empty}>아직 랭킹이 없어요. 1등에 도전해 보세요! 🏆</Text>
            ) : (
              <FlatList
                data={entries}
                keyExtractor={(item, i) => item.id || String(i)}
                renderItem={({ item, index }) => {
                  const cat = CAT_BY_ID[item.catId];
                  const me = myEntryId && item.id === myEntryId;
                  return (
                    <View style={[styles.rankRow, me && styles.rankMe]}>
                      <Text style={styles.rankPos}>{MEDALS[index] || index + 1}</Text>
                      <Text style={styles.rankName} numberOfLines={1}>
                        {(cat ? cat.emoji + ' ' : '') + item.nickname}
                      </Text>
                      <Text style={styles.rankScore}>{item.score}</Text>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.panel,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: theme.text, fontSize: 22, fontWeight: '800' },
  close: { color: theme.textDim, fontSize: 20, fontWeight: '700' },
  hint: { color: theme.textDim, fontSize: 13, marginTop: 10, lineHeight: 19 },
  bold: { color: theme.text, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 14 },
  input: {
    flex: 1,
    backgroundColor: theme.bgDeep,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  msg: { marginTop: 10, fontSize: 14, fontWeight: '600' },
  msgOk: { color: theme.good },
  msgErr: { color: theme.angry },
  listWrap: { marginTop: 16, flexShrink: 1 },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 24, fontSize: 14 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: theme.panelSoft,
  },
  rankMe: { borderWidth: 1.5, borderColor: theme.accentSoft },
  rankPos: { color: theme.gold, width: 36, fontSize: 16, fontWeight: '800' },
  rankName: { color: theme.text, flex: 1, fontSize: 15 },
  rankScore: { color: theme.accentSoft, fontSize: 16, fontWeight: '800' },
});
