interface SkeletonProps {
    w?: number;
  }
  

const Skeleton:  React.FC<SkeletonProps> = ({w}) => {
    return(
        <span className="skeleton" style={{ width: `${w??100}px` }}></span>
    )
}


export default Skeleton;