public class MapsWithEnumValuesReplaceWithEnumMap {

  public enum COLOR {
    RED, GREEN, BLUE, ORANGE;
  }
  
  public enum CITY {
  	PUNE, MUMBAI, GOA, NAGPUR;
  }
	

  public void mapMood() {
	// EMB-ISSUE: CodeIssueNames.MAPS_WITH_ENUM_VALUES_REPLACE_WITH_ENUMMAP/no-detect
	Map<Integer,String> map=new HashMap<Integer,String>();    
	// EMB-ISSUE: CodeIssueNames.MAPS_WITH_ENUM_VALUES_REPLACE_WITH_ENUMMAP/no-detect
	Map<CITY, String> mood = new EnumMap<> (CITY.class);
	// EMB-ISSUE: CodeIssueNames.MAPS_WITH_ENUM_VALUES_REPLACE_WITH_ENUMMAP
    Map<COLOR, String> moodMap = new HashMap<COLOR, String> ();
  }
}