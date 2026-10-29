// 모든 데이터 모델. 3단계에서 동결한다. 모자라면 명시적으로 열고 한 번에 고친다.
//
// 설계의 중심: 이 앱은 "아는지" 묻지 않고 "입에서 나오는지"만 본다.
// 그래서 정답 판정이 없고, 사람이 매긴 Grade 가 모든 복습 일정을 움직인다.

/** 문장 묶음. 면접이 1순위다. */
export type Track = 'interview' | 'work' | 'small'

/**
 * 자기 채점 3단계. 이 값이 복습 간격을 정한다.
 * 음성 인식 없이 완전히 동작하고, 막혔는지 아닌지는 본인이 가장 정확하게 안다.
 */
export type Grade = 'stuck' | 'shaky' | 'fluent'

/** 카드 한 장의 4박자. 3박자(가린 채 말하기)가 이 앱의 존재 이유다. */
export type Beat = 'listen' | 'shadow' | 'produce' | 'compare'

export const BEATS: readonly Beat[] = ['listen', 'shadow', 'produce', 'compare']

export const TRACKS: readonly Track[] = ['interview', 'work', 'small']

export interface Sentence {
  id: string
  track: Track
  /** 묶음 이름. '경력 설명', '못 들었을 때' 처럼 사람이 읽는 말이다. */
  group: string
  ko: string
  en: string
  /** 왜 이 표현인지 짧게. 외울 거리를 늘리지 않는다. */
  note: string
  /** 어느 문안에서 왔나. 사실이 바뀌면 추적해서 고친다. */
  source: string
  /** 번들된 기준 음원 경로. 앱에서 직접 추가한 문장은 null 이고 런타임 TTS 로 읽는다. */
  audio: string | null
  /** 앱 안에서 사람이 추가·수정한 문장인가. 코퍼스를 다시 심어도 지워지지 않는다. */
  custom: boolean
}

/** 문장별 복습 상태. 없으면 아직 한 번도 안 한 문장이다. */
export interface Review {
  sentenceId: string
  /** 다음 복습일 'YYYY-MM-DD'. 오늘 이하면 복습 대상이다. */
  due: string
  /** 복습 간격(일) */
  interval: number
  /** 쉬움 계수. 잘 나오는 문장은 점점 멀어진다. */
  ease: number
  /** 연속으로 '바로 나왔다' 를 받은 횟수 */
  streak: number
  lastGrade: Grade | null
  /** 누적 막힘 횟수. 약점 목록을 이것으로 세운다. */
  stuckCount: number
  /** 마지막으로 연습한 날 'YYYY-MM-DD' */
  reviewedAt: string | null
}

/**
 * 지금 하고 있는 세션. **매 박자마다 저장한다.**
 * 지하철에서 내리면 앱이 닫히니까, 이 행이 곧 중단 복원이다.
 */
export interface Session {
  id: string
  /** 'YYYY-MM-DD' */
  date: string
  sentenceIds: readonly string[]
  /** 지금 몇 번째 카드인가 */
  index: number
  beat: Beat
  /** 이 세션에서 매긴 채점. sentenceId → Grade */
  grades: Readonly<Record<string, Grade>>
  startedAt: string
  finishedAt: string | null
}

/** 녹음은 Blob 이라 변경 집합·내보내기에 넣지 않는다. 문장별 최근 3개만 남긴다. */
export interface Recording {
  id: string
  sentenceId: string
  blob: Blob
  mime: string
  createdAt: number
}

/** 날짜별 기록. 연속일과 기록 화면이 이걸 읽는다. */
export interface DayLog {
  /** 'YYYY-MM-DD' — 이 테이블의 키다 */
  date: string
  spoken: number
  stuck: number
}

export type ThemeChoice = 'auto' | 'light' | 'dark'

export interface Settings {
  /** Dexie 키. 행은 늘 하나다. */
  id: 'settings'
  /** 한 세션에 넣을 카드 수 */
  dailyCount: number
  /** 기준 음원 기본 재생 속도 */
  speed: number
  theme: ThemeChoice
  /** 밀린 복습이 몰렸을 때 한 번에 가져올 상한 */
  catchUpCap: number
  /** 연습할 트랙 */
  tracks: readonly Track[]
}

export const GRADE_LABELS: Readonly<Record<Grade, string>> = {
  stuck: '막혔다',
  shaky: '더듬었다',
  fluent: '바로 나왔다',
}

export const BEAT_LABELS: Readonly<Record<Beat, string>> = {
  listen: '듣기',
  shadow: '겹쳐 말하기',
  produce: '가린 채 말하기',
  compare: '대조와 채점',
}

export const TRACK_LABELS: Readonly<Record<Track, string>> = {
  interview: '면접 영어',
  work: '업무 기술 영어',
  small: '짧은 것',
}
